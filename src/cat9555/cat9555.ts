/*
 * Node.js CAT9555
 *
 * Copyright (c) 2023 Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a CAT9555 I2C port expander IC.
 */
import { EventEmitter } from 'events';
import { I2CBus } from 'i2c-bus';
import { Gpio} from 'onoff';
import { PromiseQueue } from '../shared/promise-queue';


// By annotating an enum option, you set the value;
// increments continue from that value:

enum CAT9555_REGISTERS {
  // The Input registers are used to read data from the port.
  INPUT_PORT_0 = 0x00,
  INPUT_PORT_1 = 0x01,
  // The Output registers are used to write data to the port.
  OUTPUT_PORT_0 = 0x02,
  OUTPUT_PORT_1 = 0x03,
  // The Polarity Inversion registers are not used except to write 0's.  Internally we use the _inverted bitmask to control pin state inversion.
  POL_INV_0 = 0x04,
  POL_INV_1 = 0x05,
  // The Config registers are used to specify a pin as input (1 bit-value) or output (0 bit-value).
  CON_PORT_0 = 0x06,
  CON_PORT_1 = 0x07
}

/**
 * Namespace for types for CAT9555
 */

export namespace CAT9555 {
  /**
   * A pin number from 0 to 15
   * @type {number}
   */
  export type PinNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

  /**
   * Possible pin directions.
   * 0 = out, 1 = in, -1 = undefined;
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
 * Interface for events of CAT9555
 */
export interface CAT9555 {
  /**
   * Emit an input event.
   * @param event 'input'
   * @param data Object containing the pin number and the value.
   */
  emit(event: 'input', data: CAT9555.InputData): boolean;

  /**
   * Emitted when an input pin has changed.
   * @param event 'input'
   * @param listener Eventlistener with an object containing the pin number and the value as first argument.
   */
  on(event: 'input', listener: (data: CAT9555.InputData) => void): this;

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
 * Class for handling a CAT9555 IC.
 */
export class CAT9555 extends EventEmitter {

  /** Constant for undefined pin direction (unused pin). */
  public static readonly DIR_UNDEF = -1;

  /** Constant for input pin direction. */
  public static readonly DIR_IN = 1;

  /** Constant for output pin direction. */
  public static readonly DIR_OUT = 0;

  /** Object containing all GPIOs used by any CAT9555 instance. */
  private static _allInstancesUsedGpios: Record<number, Gpio> = {};

  /** The instance of the i2c-bus, which is used for the I2C communication. */
  private _i2cBus: I2CBus;

  /** The address of the CAT9555 IC. */
  private _address: number;

  /** Number of pins the IC has. */
  private _pins: 8 | 16;

  /** Direction of each pin. By default all pin directions are undefined. */
  private _directions: Array<CAT9555.PinDirection>;

  /** Bitmask for all input pins. Used to set all input pins to high on the CAT9555 IC. */
  private _inputPinBitmask: number = 0xFFFF;

  /** Bitmask for inverted pins. */
  private _inverted: number;

  /** Bitmask representing the current state of the pins. */
  private _currentState: number;

  /** Flag if we are currently polling changes from the CAT9555 IC. */
  private _currentlyPolling: boolean = false;

  /** PromiseQueue to handle requested polls in order. */
  private _pollQueue: PromiseQueue = new PromiseQueue(3);

  /** Pin number of GPIO to detect interrupts, or null by default. */
  private _gpioPin: number | null = null;

  /** Instance of the used GPIO to detect interrupts, or null if no interrupt is used. */
  private _gpio: Gpio = null;

  /**
   * Constructor for a new CAT9555 instance.
   * If you use this IC with one or more input pins, you have to call ...
   *  a) enableInterrupt(gpioPin) to detect interrupts from the IC using a GPIO pin, or
   *  b) doPoll() frequently enough to detect input changes with manually polling.
   * @param  {I2cBus}         i2cBus       Instance of an opened i2c-bus.
   * @param  {number}         address      The address of the CAT9555 IC.
   * @param  {boolean|number} initialState The initial state of the pins of this IC. You can set a bitmask to define each pin seprately, or use true/false for all pins at once.
   */
  constructor (i2cBus: I2CBus, address: number, initialState: boolean | number) {
    super();

    // bind the _handleInterrupt method strictly to this instance
    this._handleInterrupt = this._handleInterrupt.bind(this);

    this._i2cBus = i2cBus;

    // cat9555 has 16 pins
    this._pins = 16;

    if (address < 0 || address > 255) {
      throw new Error('Address out of range');
    }
    this._address = address;

    // set pin directions to undefined
    this._directions = new Array(this._pins).fill(CAT9555.DIR_UNDEF);

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
    this._currentState = initialState

    // On startup, Force no Polarity Invert as we will manage this in software with the _inverted bitField.
    this._i2cBus.writeI2cBlockSync(this._address, CAT9555_REGISTERS.POL_INV_0, 2, Buffer.from([0x00, 0x00]));

    // On startup, Force all ports for input (default is 0xFFFF).
    const inputPinBitmask = this._inputPinBitmask;

    this._i2cBus.writeI2cBlockSync(this._address, CAT9555_REGISTERS.CON_PORT_0, 2, Buffer.from([inputPinBitmask & 0xFF, (inputPinBitmask >> 8) & 0xFF]));

    // On startup, Write the initial state which should have no effect as all ports set as input but ensures output register is set appropriately.
    this._i2cBus.writeI2cBlockSync(this._address, CAT9555_REGISTERS.OUTPUT_PORT_0, 2, Buffer.from([initialState & 0xFF, (initialState >> 8) & 0xFF]));
  }

  /**
   * Enable the interrupt detection on the specified GPIO pin.
   * You can use one GPIO pin for multiple instances of the CAT9555 class.
   * @param {number} gpioPin BCM number of the pin, which will be used for the interrupts from the CAT9555 IC.
   * @throws Error if interrupt is already enabled.
   */
  public enableInterrupt (gpioPin: number): void {
    if (this._gpio !== null) {
      throw new Error('GPIO interrupt already enabled.');
    }

    if (CAT9555._allInstancesUsedGpios[gpioPin]) {
      // use already initalized GPIO
      this._gpio = CAT9555._allInstancesUsedGpios[gpioPin];
      this._gpio['cat9555UseCount']++;
    } else {
      // init the GPIO as input with falling edge,
      // because the CAT9555 will lower the interrupt line on changes
      this._gpio = new Gpio(gpioPin, 'in', 'falling');
      this._gpio['cat9555UseCount'] = 1;
      CAT9555._allInstancesUsedGpios[gpioPin] = this._gpio;
    }
    // cache this value so we can properly nullify entry in static_allInstancesUsedGpios object during disableInterrupt calls.
    this._gpioPin = gpioPin;
    this._gpio.watch(this._handleInterrupt);
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
  public disableInterrupt (): void {
    // release the used GPIO
    if (this._gpio !== null) {
      // remove the interrupt handling
      this._gpio.unwatch(this._handleInterrupt);

      // decrease the use count of the GPIO and unexport it if not used anymore
      this._gpio['cat9555UseCount']--;
      if (this._gpio['cat9555UseCount'] === 0) {
        if (this._gpioPin !== null) {
          // delete the registered gpio from our allInstancesUsedGpios object as reference count is 0 and gpio is being unexported
          delete CAT9555._allInstancesUsedGpios[this._gpioPin];
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
   * @param  {CAT9555.PinNumber} pin     The bit-number in the bitmask.
   * @param  {boolean}           value   The new value for the bit. (true=set, false=clear)
   * @return {number}                    The new (modified) bitmask.
   */
  private _setStatePin (current: number, pin: CAT9555.PinNumber, value: boolean): number {
    if(value){
      // set the bit
      return current | 1 << pin;
    }else{
      // clear the bit
      return current & ~(1 << pin);
    }
  }

  /**
   * Write the current stateto the IC.
   * @param  {number}  newState (optional) The new state which will be set. If omitted the current state will be used.
   * @return {Promise}          Promise which gets resolved when the state is written to the IC, or rejected in case of an error.
   */
  private _setNewState (newState?: number): Promise<void> {
    return new Promise((resolve: () => void, reject: (err: Error) => void) => {

      if (typeof(newState) === 'number') {
        this._currentState = newState;
      }

      // repect inverted with bitmask using XOR
      let newIcState = this._currentState ^ this._inverted;

      // set all input pins to high
      newIcState = newIcState | this._inputPinBitmask;
      this._i2cBus.writeI2cBlock(this._address, CAT9555_REGISTERS.OUTPUT_PORT_0, 2, Buffer.from([newIcState & 0xFF, (newIcState >> 8) & 0xFF]), (err, bytesWritten) => {
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
  private _setInputPinBitmask (inputPinBitmask: number): Promise<void> {
    return new Promise((resolve: () => void, reject: (err: Error) => void) => {
      this._i2cBus.writeI2cBlock(this._address, CAT9555_REGISTERS.CON_PORT_0, 2, Buffer.from([inputPinBitmask & 0xFF, (inputPinBitmask >> 8) & 0xFF]), (err, bytesWritten) => {
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
   * Manually poll changed inputs from the CAT9555 IC.
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
   * Internal function to poll the changes from the CAT9555 IC.
   * If a change on an input is detected, an "input" Event will be emitted with a data object containing the "pin" and the new "value".
   * This is called if an interrupt occured, or if doPoll() is called manually.
   * Additionally this is called if a new input is defined to read the current state of this pin.
   * @param {CAT9555.PinNumber} noEmit (optional) Pin number of a pin which should not trigger an event. (used for getting the current state while defining a pin as input)
   * @return {Promise<number>} - value representing pin states following any I2C read/write and update of the internal state.
   */
  private _poll (noEmit?: CAT9555.PinNumber): Promise<number> {
    const bus = this._i2cBus, addr = this._address;
    if (this._currentlyPolling) {
      return Promise.reject('An other poll is in progress');
    }

    this._currentlyPolling = true;

    return new Promise((resolve: (value:number) => void, reject: (err: Error) => void) => {
      // helper function to process the read data for all IC types
      const processRead = (readState: number): void => {

        // respect inverted with bitmask using XOR
        readState = readState ^ this._inverted;
        const currentState = this._currentState;

        // check each input for changes
        for (let pin = 0; pin < this._pins; pin++) {
          if (this._directions[pin] !== CAT9555.DIR_IN) {
            continue; // isn't an input pin
          }
          if ((currentState >> pin) % 2 !== (readState >> pin) % 2) {
            // pin changed
            const value: boolean = ((readState >> pin) % 2 !== 0);
            this._currentState = this._setStatePin(this._currentState, pin as CAT9555.PinNumber, value);
            if (noEmit !== pin) {
              this.emit('input', <CAT9555.InputData>{ pin: pin, value: value });
            }
          }
        }
        if (this._currentState != currentState) {
          this.emit('poll', this._currentState);
        }
        resolve(this._currentState);
      }

      bus.readI2cBlock(addr, CAT9555_REGISTERS.INPUT_PORT_0, 2, Buffer.alloc(2), (err, bytesRead, buffer) => {
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
   * @param  {CAT9555.PinNumber} pin          The pin number. (0 to 15)
   * @param  {boolean}           inverted     true if this pin should be handled inverted (true=low, false=high)
   * @param  {boolean}           initialValue (optional) The initial value of this pin, which will be set immediatly.
   * @return {Promise}
   */
  public outputPin (pin: CAT9555.PinNumber, inverted: boolean, initialValue?: boolean): Promise<void> {
    if (pin < 0 || pin > (this._pins - 1)) {
      return Promise.reject(new Error('Pin out of range'));
    }

    this._inverted = this._setStatePin(this._inverted, pin, inverted);

    this._inputPinBitmask = this._setStatePin(this._inputPinBitmask, pin, false);

    this._directions[pin] = CAT9555.DIR_OUT;

    // set the initial value only if it is defined, otherwise keep the last value (probably from the initial state)
    if (typeof (initialValue) === 'undefined') {
      return this._setInputPinBitmask(this._inputPinBitmask)
        //... and return resolved promise as nothing else need be done.
        .then(() => Promise.resolve(null));
    }else{
      return this._setInputPinBitmask(this._inputPinBitmask)
        // ... and then set the internal pin state.
        .then(() => this._setPinInternal(pin, initialValue));
    }
  }

  /**
   * Define a pin as an input.
   * This marks the pin for input processing and activates the high level on this pin.
   * @param  {CAT9555.PinNumber} pin      The pin number. (0 to 15)
   * @param  {boolean}           inverted true if this pin should be handled inverted (high=false, low=true)
   * @return {Promise<number>} - value representing pin states following any I2C read/write and update of the internal state.
   */
  public inputPin (pin: CAT9555.PinNumber, inverted: boolean): Promise<number> {
    if (pin < 0 || pin > (this._pins - 1)) {
      return Promise.reject(new Error('Pin out of range'));
    }

    this._inverted = this._setStatePin(this._inverted, pin, inverted);

    this._inputPinBitmask = this._setStatePin(this._inputPinBitmask, pin, true);

    this._directions[pin] = CAT9555.DIR_IN;

    // set the input bit mask
    return this._setInputPinBitmask(this._inputPinBitmask)
      // ... and call _setNewState() to activate the high level on the input pin ...
      .then(() => this._setNewState())
      // ... and then poll all current inputs with noEmit on this pin to suppress the event
      .then(() => {
        return this._pollQueue.enqueue(() => this._poll(pin));
      });
  }

  /**
   * Set the value of an output pin.
   * If no value is given, the pin will be toggled.
   * @param  {CAT9555.PinNumber} pin   The pin number. (0 to 15)
   * @param  {boolean}           value The new value for this pin.
   * @return {Promise}
   */
  public setPin (pin: CAT9555.PinNumber, value?: boolean): Promise<void> {
    if (pin < 0 || pin > (this._pins - 1)) {
      return Promise.reject(new Error('Pin out of range'));
    }

    if (this._directions[pin] !== CAT9555.DIR_OUT) {
      return Promise.reject(new Error('Pin is not defined as output'));
    }

    if (typeof(value) == 'undefined') {
      // set value dependend on current state to toggle
      value = !((this._currentState>>pin) % 2 !== 0);
    }

    return this._setPinInternal(pin, value);
  }

  /**
   * Internal function to set the state of a pin, regardless its direction.
   * @param  {CAT9555.PinNumber} pin   The pin number. (0 to 15)
   * @param  {boolean}           value The new value.
   * @return {Promise}
   */
  private _setPinInternal (pin: CAT9555.PinNumber, value: boolean): Promise<void> {
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
      if (this._directions[pin] !== CAT9555.DIR_OUT) {
        continue; // isn't an output pin
      }
      newState = this._setStatePin(newState, pin as CAT9555.PinNumber, booleanValue ? value : ((value & (1 << pin)) !== 0));
    }
    return this._setNewState(newState);
  }

  /**
   * Returns the current value of a pin.
   * This returns the last saved value, not the value currently returned by the CAT9555 IC.
   * To get the current value call doPoll() first, if you're not using interrupts.
   * @param  {CAT9555.PinNumber} pin The pin number. (0 to 15)
   * @return {boolean}               The current value.
   */
  public getPinValue (pin: CAT9555.PinNumber): boolean {
    if (pin < 0 || pin > (this._pins - 1)) {
      return false;
    }
    return ((this._currentState>>pin) % 2 !== 0);
  }
}