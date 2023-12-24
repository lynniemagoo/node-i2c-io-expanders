/*
 * Node.js MCP23017
 *
 * Copyright (c) 2023 Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a MCP23017 I2C port expander IC.
 */
import { EventEmitter } from 'events';
import { I2CBus } from 'i2c-bus';
import { Gpio } from 'onoff';
import { PromiseQueue } from '../shared/promise-queue';


// By annotating an enum option, you set the value;
// increments continue from that value:

enum MCP23017_IOCON_FLAGS {
  DEFAULT = 0x00,
  /*
  ADDR_BANK_0 = 0x00,
  INT_MIRROR_OFF = 0x00,
  SEQ_OP_ENABLE = 0x00,
  SDA_SLEW_ENABLED = 0x00,
  MCP23S17_HW_ADDR_DISABLED = 0x00,
  INT_OPEN_DRAIN_DISABLED = 0x00,
  INT_POLARITY_LOW = 0x00,
  */
  ADDR_BANK_1 = 0x80,
  INT_MIRROR_ON = 0x40,
  SEQ_OP_DISABLE = 0x20,
  SDA_SLEW_DISABLED = 0x10,
  MCP23S17_HW_ADDR_ENABLED = 0x08,
  INT_OPEN_DRAIN_ENABLED = 0x04,
  INT_POLARITY_HIGH = 0x02
}

// These are Bank0 mappings (see datasheet for bank 1)
enum MCP23017_REGISTERS {
  IODIRA = 0x00, // IO direction A - 1= input 0 = output
  IODIRB = 0x01, // IO direction B - 1= input 0 = output

  // Input polarity A - If a bit is set, the corresponding GPIO register bit
  // will reflect the inverted value on the pin.
  IPOLA = 0x02,
  // Input polarity B - If a bit is set, the corresponding GPIO register bit
  // will reflect the inverted value on the pin.
  IPOLB = 0x03,

  // The GPINTEN register controls the interrupt-onchange feature for each
  // pin on port A.
  GPINTENA = 0x04,
  // The GPINTEN register controls the interrupt-onchange feature for each
  // pin on port B.
  GPINTENB = 0x05,

  // Default value for port A - These bits set the compare value for pins
  // configured for interrupt-on-change.  If the associated pin level is the
  // opposite from the register bit, an interrupt occurs.
  DEFVALA = 0x06,
  // Default value for port B - These bits set the compare value for pins
  // configured for interrupt-on-change.  If the associated pin level is the
  // opposite from the register bit, an interrupt occurs.
  DEFVALB = 0x07,

  // Interrupt control register for port A.  If 1 interrupt is fired when the
  // pin matches the default value, if 0 the interrupt is fired on state
  // change
  INTCONA = 0x08,
  // Interrupt control register for port B.  If 1 interrupt is fired when the
  // pin matches the default value, if 0 the interrupt is fired on state
  // change
  INTCONB = 0x09,

  IOCONA = 0x0A, // see datasheet for configuration register
  IOCONB = 0x0B, // see datasheet for configuration register

  GPPUA = 0x0C, // pull-up resistors for port A
  GPPUB = 0x0D, // pull-up resistors for port B
  // The INTF register reflects the interrupt condition on the port A pins of
  // any pin that is enabled for interrupts. A set bit indicates that the
  // associated pin caused the interrupt.
  INTFA = 0x0E,
  // The INTF register reflects the interrupt condition on the port B pins of
  // any pin that is enabled for interrupts.  A set bit indicates that the
  // associated pin caused the interrupt.
  INTFB = 0x0F,
  // The INTCAP register captures the GPIO port A value at the time the
  // interrupt occurred.
  INTCAPA = 0x10,
  // The INTCAP register captures the GPIO port B value at the time the
  // interrupt occurred.
  INTCAPB = 0x11,
  GPIOA = 0x12, // Data port A
  GPIOB = 0x13, // Data port B
  OLATA = 0x14, // Output latches A
  OLATB = 0x15 // Output latches B
}

/**
 * Namespace for types for MCP23017
 */

export namespace MCP23017 {
  /**
   * A pin number from 0 to 15
   * @type {number}
   */
  export type PinNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

  /**
   * Possible pin directions.
   * 0 = out, 1 = in, -1 = undefined
   */
  export type PinDirection = 0 | 1 | -1;

  /**
   * Data of an 'input' event
   * @type {Object}
   */
  export type InputData = {
    /**
     * Number of the pin which triggerd the event
     * @type {PinNumber}
     */
    pin: PinNumber;

    /**
     * New value of the pin
     * @type {boolean}
     */
    value: boolean;
  }
}

/**
 * Interface for events of MCP23017
 */
export interface MCP23017 {
  /**
   * Emit an input event.
   * @param event 'input'
   * @param data Object containing the pin number and the value.
   */
  emit(event: 'input', data: MCP23017.InputData): boolean;

  /**
   * Emitted when an input pin has changed.
   * @param event 'input'
   * @param listener Eventlistener with an object containing the pin number and the value as first argument.
   */
  on(event: 'input', listener: (data: MCP23017.InputData) => void): this;

  /**
   * Emit a poll event.
   * @param event 'poll'
   * @param value number containing the pin number and the value.
   */
  emit (event: 'poll', value: number): boolean;

  /**
   * Emitted when a poll has completed.
   * @param event 'poll'
   * @param listener Eventlistener with a number containing the state of the pins following the poll.
   */
  on (event: 'poll', listener: (value: number) => void): this;
}

/**
 * Class for handling a MCP23017 IC.
 */
export class MCP23017 extends EventEmitter {

  /** Constant for undefined pin direction (unused pin). */
  public static readonly DIR_UNDEF = -1;

  /** Constant for input pin direction. */
  public static readonly DIR_IN = 1;

  /** Constant for output pin direction. */
  public static readonly DIR_OUT = 0;

  /** Object containing all GPIOs used by any MCP23017 instance. */
  private static _allInstancesUsedGpios: Record < number, Gpio > = {};

  /** The instance of the i2c-bus, which is used for the I2C communication. */
  private _i2cBus: I2CBus;

  /** The address of the MCP23017 IC. */
  private _address: number;

  /** Number of pins the IC has. */
  private _pins: 8 | 16;

  /** Direction of each pin. By default all pin directions are undefined. */
  private _directions: Array < MCP23017.PinDirection >;

  /** Bitmask for all input pins. Used to set all input pins to high on the MCP23017 IC. */
  private _inputPinBitmask: number = 0xFFFF;

  /** Bitmask for inverted pins. */
  private _inverted: number;

  /** Bitmask representing the current state of the pins. */
  private _currentState: number;

  /** Flag if we are currently polling changes from the MCP23017 IC. */
  private _currentlyPolling: boolean = false;

  /** PromiseQueue to handle requested polls in order. */
  private _pollQueue: PromiseQueue = new PromiseQueue(3);

  /** Pin number of GPIO to detect interrupts, or null by default. */
  private _gpioPin: number | null = null;

  /** Instance of the used GPIO to detect interrupts, or null if no interrupt is used. */
  private _gpio: Gpio = null;

  private _ioconFlags: MCP23017_IOCON_FLAGS = 0x00;

  private static _BUFF_ALL_ON: Buffer = Buffer.from([0xFF, 0xFF]);
  private static _BUFF_ALL_OFF: Buffer = Buffer.from([0x00, 0x00]);

  /**
   * Constructor for a new MCP23017 instance.
   * If you use this IC with one or more input pins, you have to call ...
   *  a) enableInterrupt(gpioPin) to detect interrupts from the IC using a GPIO pin, or
   *  b) doPoll() frequently enough to detect input changes with manually polling.
   * @param  {I2cBus}         i2cBus       Instance of an opened i2c-bus.
   * @param  {number}         address      The address of the MCP23017 IC.
   * @param  {boolean|number} initialState The initial state of the pins of this IC. You can set a bitmask to define each pin seprately, or use true/false for all pins at once.
   */
  constructor(i2cBus: I2CBus, address: number, initialState: boolean | number) {
    super();

    // bind the _handleInterrupt method strictly to this instance
    this._handleInterrupt = this._handleInterrupt.bind(this);

    this._i2cBus = i2cBus;

    // mcp23017 has 16 pins
    this._pins = 16;

    if (address < 0 || address > 255) {
      throw new Error('Address out of range');
    }
    this._address = address;

    // set pin directions to undefined
    this._directions = new Array(this._pins).fill(MCP23017.DIR_UNDEF);

    // nothing inverted by default
    this._inverted = 0;

    if (initialState === true) {
      initialState = Math.pow(2, this._pins) - 1;
    } else if (initialState === false) {
      initialState = 0;
    } else if (typeof (initialState) !== 'number' || initialState < 0 || initialState > Math.pow(2, this._pins) - 1) {
      throw new Error('InitalState bitmask out of range');
    }

    // Save the inital state as current state and write it to the IC
    this._currentState = initialState;

    // On startup, Force all ports for input (default is 0xFFFF).
    const inputPinBitmask = this._inputPinBitmask;

    // On startup, Default chip config to use Bank 0 with Interrupt Mirroring and Open-Drain (Active Low) interrupts
    this._ioconFlags =
      MCP23017_IOCON_FLAGS.DEFAULT |
      MCP23017_IOCON_FLAGS.INT_MIRROR_ON |
      MCP23017_IOCON_FLAGS.INT_OPEN_DRAIN_ENABLED;

    this._i2cBus.writeByteSync(this._address, MCP23017_REGISTERS.IOCONA, this._ioconFlags);

    // On startup, disable all interrupts.
    this._i2cBus.writeI2cBlockSync(this._address, MCP23017_REGISTERS.GPINTENA, 2, MCP23017._BUFF_ALL_OFF);

    // On startup, Force all pins to input.
    this._i2cBus.writeI2cBlockSync(this._address, MCP23017_REGISTERS.IODIRA, 2, Buffer.from([inputPinBitmask & 0xFF, (inputPinBitmask >> 8) & 0xFF]));

    // On startup, Force all pins to Pull-Up.
    this._i2cBus.writeI2cBlockSync(this._address, MCP23017_REGISTERS.GPPUA, 2, MCP23017._BUFF_ALL_ON);

    // On startup, Force no Polarity Invert as we will manage this in software with the _inverted bitField.
    this._i2cBus.writeI2cBlockSync(this._address, MCP23017_REGISTERS.IPOLA, 2, MCP23017._BUFF_ALL_OFF);

    // On startup, Set interrupt change default values to 0.
    this._i2cBus.writeI2cBlockSync(this._address, MCP23017_REGISTERS.DEFVALA, 2, MCP23017._BUFF_ALL_OFF);

    // On startup, Force interrupts to fire on state change - don't compare to DEFVAL.
    this._i2cBus.writeI2cBlockSync(this._address, MCP23017_REGISTERS.INTCONA, 2, MCP23017._BUFF_ALL_OFF);

    // On startup, Write the initial state which should have no effect as all ports set as input but ensures output register is set appropriately.
    this._i2cBus.writeI2cBlockSync(this._address, MCP23017_REGISTERS.OLATA, 2, Buffer.from([initialState & 0xFF, (initialState >> 8) & 0xFF]));
  }

  /**
   * Enable the interrupt detection on the specified GPIO pin.
   * You can use one GPIO pin for multiple instances of the MCP23017 class.
   * @param {number} gpioPin BCM number of the pin, which will be used for the interrupts from the MCP23017 IC.
   * @throws Error if interrupt is already enabled.
   */
  public enableInterrupt(gpioPin: number): void {
    if (this._gpio !== null) {
      throw new Error('GPIO interrupt already enabled.');
    }

    if (MCP23017._allInstancesUsedGpios[gpioPin]) {
      // use already initalized GPIO
      this._gpio = MCP23017._allInstancesUsedGpios[gpioPin];
      this._gpio['mcp23017UseCount']++;
    } else {
      // init the GPIO as input with falling edge,
      // because the MCP23017 will lower the interrupt line on changes
      this._gpio = new Gpio(gpioPin, 'in', 'falling');
      this._gpio['mcp23017UseCount'] = 1;
      MCP23017._allInstancesUsedGpios[gpioPin] = this._gpio;
    }
    // cache this value so we can properly nullify entry in static_allInstancesUsedGpios object during disableInterrupt calls.
    this._gpioPin = gpioPin;
    this._gpio.watch(this._handleInterrupt);
    // Enable interrupts based on current input pins
    const inputPinBitmask: number = this._inputPinBitmask;
    this._i2cBus.writeI2cBlockSync(this._address, MCP23017_REGISTERS.GPINTENA, 2, Buffer.from([inputPinBitmask & 0xFF, (inputPinBitmask >> 8) & 0xFF]));
  }

  /**
   * Internal function to handle a GPIO interrupt.
   */
  private _handleInterrupt (): void {
    // enqueue a poll of current state and ignore any rejected promise
    this._pollQueue.enqueue(() => this._poll()).catch(() => { /* nothing to do here */ });
  }

  /**
   * Disable the interrupt detection.
   * This will unexport the interrupt GPIO, if it is not used by an other instance of this class.
   */
  public disableInterrupt(): void {
    // release the used GPIO
    if (this._gpio !== null) {
      // disable all interrupts
      this._i2cBus.writeI2cBlockSync(this._address, MCP23017_REGISTERS.GPINTENA, 2, MCP23017._BUFF_ALL_OFF);
      // remove the interrupt handling
      this._gpio.unwatch(this._handleInterrupt);

      // decrease the use count of the GPIO and unexport it if not used anymore
      this._gpio['mcp23017UseCount']--;
      if (this._gpio['mcp23017UseCount'] === 0) {
        if (this._gpioPin !== null) {
          // delete the registered gpio from our allInstancesUsedGpios object as reference count is 0 and gpio is being unexported
          delete MCP23017._allInstancesUsedGpios[this._gpioPin];
        }
        this._gpio.unexport();
      }
      this._gpioPin = null;
      this._gpio = null;
    }
  }

  /**
   * Helper function to set/clear one bit in a bitmask.
   * @param  {number}            current The current bitmask.
   * @param  {MCP23017.PinNumber} pin     The bit-number in the bitmask.
   * @param  {boolean}           value   The new value for the bit. (true=set, false=clear)
   * @return {number}                    The new (modified) bitmask.
   */
  private _setStatePin(current: number, pin: MCP23017.PinNumber, value: boolean): number {
    if (value) {
      // set the bit
      return current | 1 << pin;
    } else {
      // clear the bit
      return current & ~(1 << pin);
    }
  }

  /**
   * Write the current stateto the IC.
   * @param  {number}  newState (optional) The new state which will be set. If omitted the current state will be used.
   * @return {Promise}          Promise which gets resolved when the state is written to the IC, or rejected in case of an error.
   */
  private _setNewState(newState ? : number): Promise < void > {
    return new Promise((resolve: () => void, reject: (err: Error) => void) => {

      if (typeof(newState) === 'number') {
        this._currentState = newState;
      }

      // repect inverted with bitmask using XOR
      let newIcState = this._currentState ^ this._inverted;

      // set all input pins to high
      newIcState = newIcState | this._inputPinBitmask;

      this._i2cBus.writeI2cBlock(this._address, MCP23017_REGISTERS.OLATA, 2, Buffer.from([newIcState & 0xFF, (newIcState >> 8) & 0xFF]), (err, bytesWritten) => {
        if (err || (bytesWritten != 2)) {
          reject(err);
        }
        else {
          resolve();
        }
      });
    });
  }

  /**
   * Write the input bit mask to the IC.
   * @param  {number}  inputPinBitmask .
   * @return {Promise} Promise which gets resolved when the inputPinBitmask is written to the IC, or rejected in case of an error.
   */
  private _setInputPinBitmask(inputPinBitmask: number): Promise < void > {
    return new Promise((resolve: () => void, reject: (err: Error) => void) => {
      const buffWrite = Buffer.from([inputPinBitmask & 0xFF, (inputPinBitmask >> 8) & 0xFF]);
      const buffDisableInterrupts = MCP23017._BUFF_ALL_OFF;
      // Update pin direction and then enable interrupts accordingly.
      this._i2cBus.writeI2cBlock(this._address, MCP23017_REGISTERS.IODIRA, 2, buffWrite, (err, bytesWritten) => {
        if (err || (bytesWritten != 2)) {
          reject(err);
        }
        else {
          const interruptControl = (this._gpio !== null) ? buffWrite : buffDisableInterrupts;
          // interrupts are enabled so update based on input pins
          this._i2cBus.writeI2cBlock(this._address, MCP23017_REGISTERS.GPINTENA, 2, interruptControl, (err, bytesWritten) => {
            if (err || (bytesWritten != 2)) {
              reject(err);
            }
            else {
              resolve();
            }
          });
        }
      });
    });
  }

  /**
   * Manually poll changed inputs from the MCP23017 IC.
   * If a change on an input is detected, an "input" Event will be emitted with a data object containing the "pin" and the new "value".
   * This have to be called frequently enough if you don't use a GPIO for interrupt detection.
   * If you poll again before the last poll was completed, the new poll will be queued up the be executed after the current poll.
   * If you poll again while also a poll is queued, this will be rejected.
   * @return {Promise<number>} - value representing pin states following any I2C read/write and update of the internal state.
   */
  public doPoll (): Promise<number> {
    return this._pollQueue.enqueue(() => this._poll());
  }


  /**
   * Internal function to poll the changes from the MCP23017 IC.
   * If a change on an input is detected, an "input" Event will be emitted with a data object containing the "pin" and the new "value".
   * This is called if an interrupt occured, or if doPoll() is called manually.
   * Additionally this is called if a new input is defined to read the current state of this pin.
   * @param {MCP23017.PinNumber} noEmit (optional) Pin number of a pin which should not trigger an event. (used for getting the current state while defining a pin as input)
   * @return {Promise<number>} - value representing pin states following any I2C read/write and update of the internal state.
   */
  private _poll (noEmit?: MCP23017.PinNumber): Promise<number> {
    const bus = this._i2cBus, addr = this._address;
    if (this._currentlyPolling) {
      return Promise.reject('An other poll is in progress');
    }

    this._currentlyPolling = true;

    return new Promise((resolve: (value: number) => void, reject: (err: Error) => void) => {
      // helper function to process the read data for all IC types
      const processRead = (readState: number): void => {
        // respect inverted with bitmask using XOR
        readState = readState ^ this._inverted;
        const currentState = this._currentState;

        // check each input for changes
        for (let pin = 0; pin < this._pins; pin++) {
          if (this._directions[pin] !== MCP23017.DIR_IN) {
            continue; // isn't an input pin
          }
          if ((this._currentState >> pin) % 2 !== (readState >> pin) % 2) {
            // pin changed
            const value: boolean = ((readState >> pin) % 2 !== 0);
            this._currentState = this._setStatePin(this._currentState, pin as MCP23017.PinNumber, value);
            if (noEmit !== pin) {
              this.emit('input', <MCP23017.InputData>{ pin: pin, value: value });
            }
          }
        }
        if (this._currentState != currentState) {
          this.emit('poll', this._currentState);
        }
        resolve(this._currentState);
      }

      bus.readI2cBlock(addr, MCP23017_REGISTERS.GPIOA, 2, Buffer.alloc(2), (err, bytesRead, buffer) => {
        this._currentlyPolling = false;
        if (err || (bytesRead != 2)) {
          reject(err);
        } else {

          // Readstate is 16 bit reverse of byte ordering.  Pins 0-7 are in byte 0.  Pins 8-15 are in byte 1.
          const readState = (buffer[0] | buffer[1] << 8);

          processRead(readState);
        }
      });
    });
  }

  /**
   * Returns if one or multiple polls are currently queued for execution.
   * @returns `true` if we are currently polling.
   */
  public isPolling (): boolean {
    return !this._pollQueue.isEmpty();
  }

  /**
   * Define a pin as an output.
   * This marks the pin to be used as an output pin.
   * @param  {MCP23017.PinNumber} pin          The pin number. (0 to 15)
   * @param  {boolean}           inverted     true if this pin should be handled inverted (true=low, false=high)
   * @param  {boolean}           initialValue (optional) The initial value of this pin, which will be set immediatly.
   * @return {Promise}
   */
  public outputPin(pin: MCP23017.PinNumber, inverted: boolean, initialValue ? : boolean): Promise < void > {
    if (pin < 0 || pin > (this._pins - 1)) {
      return Promise.reject(new Error('Pin out of range'));
    }

    this._inverted = this._setStatePin(this._inverted, pin, inverted);

    this._inputPinBitmask = this._setStatePin(this._inputPinBitmask, pin, false);

    this._directions[pin] = MCP23017.DIR_OUT;

    // set the initial value only if it is defined, otherwise keep the last value (probably from the initial state)
    if (typeof(initialValue) === 'undefined') {
      return this._setInputPinBitmask(this._inputPinBitmask)
        //... and return resolved promise as nothing else need be done.
        .then(() => Promise.resolve(null));
    } else {
      return this._setInputPinBitmask(this._inputPinBitmask)
        // ... and then set the internal pin state.
        .then(() => this._setPinInternal(pin, initialValue));
    }
  }

  /**
   * Define a pin as an input.
   * This marks the pin for input processing and activates the high level on this pin.
   * @param  {MCP23017.PinNumber} pin      The pin number. (0 to 15)
   * @param  {boolean}           inverted true if this pin should be handled inverted (high=false, low=true)
   * @return {Promise<number>} - value representing pin states following any I2C read/write and update of the internal state.
   */
  public inputPin (pin: MCP23017.PinNumber, inverted: boolean): Promise<number> {
    if (pin < 0 || pin > (this._pins - 1)) {
      return Promise.reject(new Error('Pin out of range'));
    }

    this._inverted = this._setStatePin(this._inverted, pin, inverted);

    this._inputPinBitmask = this._setStatePin(this._inputPinBitmask, pin, true);

    this._directions[pin] = MCP23017.DIR_IN;

    // set the input bit mask
    return this._setInputPinBitmask(this._inputPinBitmask)
      // ... and call _setNewState() to activate the high level on the input pin ...
      .then(() => this._setNewState())
      // ... and then poll all current inputs with noEmit on this pin to suppress the event
      .then(() => {
        return this._pollQueue.enqueue(() => this._poll(pin));
      })
  }

  /**
   * Set the value of an output pin.
   * If no value is given, the pin will be toggled.
   * @param  {MCP23017.PinNumber} pin   The pin number. (0 to 15)
   * @param  {boolean}           value The new value for this pin.
   * @return {Promise}
   */
  public setPin(pin: MCP23017.PinNumber, value ? : boolean): Promise < void > {
    if (pin < 0 || pin > (this._pins - 1)) {
      return Promise.reject(new Error('Pin out of range'));
    }

    if (this._directions[pin] !== MCP23017.DIR_OUT) {
      return Promise.reject(new Error('Pin is not defined as output'));
    }

    if (typeof(value) == 'undefined') {
      // set value dependend on current state to toggle
      value = !((this._currentState >> pin) % 2 !== 0);
    }

    return this._setPinInternal(pin, value);
  }

  /**
   * Internal function to set the state of a pin, regardless its direction.
   * @param  {MCP23017.PinNumber} pin   The pin number. (0 to 15)
   * @param  {boolean}           value The new value.
   * @return {Promise}
   */
  private _setPinInternal(pin: MCP23017.PinNumber, value: boolean): Promise < void > {
    const newState: number = this._setStatePin(this._currentState, pin, value);

    return this._setNewState(newState);
  }

  /**
   * Set the given value to all output pins if boolean or sets output pins based on bits with value if a number.
   * @param  {boolean | number} value The new value for all output pins.
   * @return {Promise}
   */
  public setAllPins (value: boolean | number): Promise<void> {
    let newState: number = this._currentState;
    const booleanValue = typeof (value) === 'boolean';
    for (let pin = 0; pin < this._pins; pin++) {
      if (this._directions[pin] !== MCP23017.DIR_OUT) {
        continue; // isn't an output pin
      }
      newState = this._setStatePin(newState, pin as MCP23017.PinNumber, booleanValue ? value : ((value & (1 << pin)) !== 0));
    }
    return this._setNewState(newState);
  }

  /**
   * Returns the current value of a pin.
   * This returns the last saved value, not the value currently returned by the MCP23017 IC.
   * To get the current value call doPoll() first, if you're not using interrupts.
   * @param  {MCP23017.PinNumber} pin The pin number. (0 to 15)
   * @return {boolean}               The current value.
   */
  public getPinValue (pin: MCP23017.PinNumber): boolean {
    if (pin < 0 || pin > (this._pins - 1)) {
      return false;
    }
    return ((this._currentState>>pin) % 2 !== 0);
  }
}