import { EventEmitter } from 'events';
import { I2CBus } from 'i2c-bus';
import { Gpio } from 'onoff';
import { PromiseQueue } from './promise-queue';

/**
 * Enum of the known IC types.
 */
export enum IOEXPANDER_TYPE {
  /** CAT9555 IC with 16 pins */
  CAT9555,

  /** MCP23017 IC with 16 pins */
  MCP23017,

  /** PCF8575 IC with 16 pins */
  PCF8575,

  /** PCF8574 IC with 8 pins */
  PCF8574
}
/**
 * Namespace for the common class PCF857x.
 */
export namespace IOExpander {

  /**
   * A pin number from 0 to 7 for PCF8574/PCF8574A.
   * @type {number}
   */
  export type PinNumber8 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

  /**
   * A pin number from 0 to 15 0 to 15 for PCF8575, CAT9555, or MCP23017.
   * @type {number}
   */
  export type PinNumber16 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

  /**
   * Possible pin directions.
   * 0 = out, 1 = in, -1 = undefined
   */
  export type PinDirection = 0 | 1 | -1;

  /**
   * Data of an 'input' event
   * @type {Object}
   */
  export type InputData<T extends IOExpander.PinNumber8 | IOExpander.PinNumber16> = {
    /**
     * Number of the pin which triggered the event
     * @type {T}
     */
    pin: T;

    /**
     * New value of the pin
     * @type {boolean}
     */
    value: boolean;
  }
}

/**
 * Interface for events of IOExpander
 */
export interface IOExpander<PinNumber extends IOExpander.PinNumber8 | IOExpander.PinNumber16> {
  /**
   * Emit an input event.
   * @param event 'input'
   * @param data Object containing the pin number and the value.
   */
  emit (event: 'input', data: IOExpander.InputData<PinNumber>): boolean;

  /**
   * Emitted when an input pin has changed.
   * @param event 'input'
   * @param listener Eventlistener with an object containing the pin number and the value as first argument.
   */
  on (event: 'input', listener: (data: IOExpander.InputData<PinNumber>) => void): this;

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
 * Class for handling a PCF8574/PCF8574A or PCF8585 IC.
 * This class shares common code for both types and has to be extend by a class
 * for the specific type.
 */
export abstract class IOExpander<PinNumber extends IOExpander.PinNumber8 | IOExpander.PinNumber16> extends EventEmitter {

  /** Constant for undefined pin direction (unused pin). */
  public static readonly DIR_UNDEF = -1;

  /** Constant for input pin direction. */
  public static readonly DIR_IN = 1;

  /** Constant for output pin direction. */
  public static readonly DIR_OUT = 0;

  /** Object containing all GPIOs used by any CAT9555 instance. */
  private static _allInstancesUsedGpios: Record<number, Gpio> = {};

  /** The instance of the i2c-bus, which is used for the I2C communication. */
  protected _i2cBus: I2CBus;

  /** The address of the CAT9555 IC. */
  protected _address: number;

  /** The type of the IC. */
  protected _type: IOEXPANDER_TYPE;

  /** Number of pins the IC has. */
  protected _pins: 8 | 16;

  /** Direction of each pin. By default all pin directions are undefined. */
  private _directions: Array<IOExpander.PinDirection>;

  /** Bitmask for all input pins. Used to set all input pins to high on the IC. */
  private _inputPinBitmask: number = 0;

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
   * Constructor for a new IOExpander instance.
   * If you use this IC with one or more input pins, you have to call ...
   *  a) enableInterrupt(gpioPin) to detect interrupts from the IC using a GPIO pin, or
   *  b) doPoll() frequently enough to detect input changes with manually polling.
   * @param  {I2cBus}         i2cBus       Instance of an opened i2c-bus.
   * @param  {number}         address      The address of the PCF857x IC.
   * @param  {boolean|number} initialState The initial state of the pins of this IC. You can set a bitmask to define each pin separately, or use true/false for all pins at once.
   * @param  {IOEXPANDER_TYPE}   type         The type of the used IC.
   */
  constructor (i2cBus: I2CBus, address: number, initialState: boolean | number, type: IOEXPANDER_TYPE) {
    super();

    // bind the _handleInterrupt method strictly to this instance
    this._handleInterrupt = this._handleInterrupt.bind(this);

    this._i2cBus = i2cBus;
    this._type = type;

    // define type specific stuff
    switch (this._type) {
      case IOEXPANDER_TYPE.CAT9555:
      case IOEXPANDER_TYPE.MCP23017:
      case IOEXPANDER_TYPE.PCF8575:
        //this._pins = 16;
        break;
      case IOEXPANDER_TYPE.PCF8574:
        //this._pins = 8;
        break;
      default:
        throw new Error('Unsupported type');
    }

    const pinCount = this._getPinCount();
    if ((pinCount !== 8) && (pinCount !== 16)) {
      throw new Error('Unsupported pin count');
    }
    this._pins = pinCount;

    // check the given address
    if (address < 0 || address > 255) {
      throw new Error('Address out of range');
    }
    this._address = address;

    // set pin directions to undefined
    this._directions = new Array(this._pins).fill(IOExpander.DIR_UNDEF);

    // nothing inverted by default
    this._inverted = 0;

    if (initialState === true) {
      initialState = Math.pow(2, this._pins) - 1;
    } else if (initialState === false) {
      initialState = 0;
    } else if (typeof (initialState) !== 'number' || initialState < 0 || initialState > Math.pow(2, this._pins) - 1) {
      throw new Error('InitialState bitmask out of range');
    }
    // save the initial state as current sate and write it to the IC
    this._currentState = initialState;

    // TODO - should this be 0 or all inputs ?
    // PCF8574 Page 1 of datasheet - all pins are high at power on meaning they can be used as inputs
    // PCF8575 Page 1 of datasheet - all pins are high at power on meaning they can be used as inputs
    // CAT9555 Page 10 of datasheet - The default values of the Configuration Port0/Configuration Port1 registers are all 1's meaning all 16 pins are input by default.
    // MCP2017 Page 16 of datasheet - The default values of IODIRA/IODIRB are all 1's meaning all 16 pins are input by default.
    this._inputPinBitmask = Math.pow(2, this._pins) - 1;

    this._initializeChip(initialState, this._inputPinBitmask);
  }

  // TODO - SHOULD CONTINUE TO SUPPORT _getPinCount as abstract method?
  // Or continue to rely on _type which is only used in construction?
  // As an alternative, we could pass in the pinCount via constructor as allowed values of 8 or 16.
  protected abstract _getPinCount() : number;
  protected abstract _initializeChip(initialState: number, inputPinBitmask: number) : void;
  protected abstract _writeState(state: number, writeComplete: (err?: Error) => void) : void;
  protected abstract _readState(readError: (err: Error) => void, readComplete: (readState: number) => void) : void;
  protected _writeDirection(inputPinBitmask: number, writeComplete: (err?: Error) => void) : void { writeComplete(); };
  protected _writeInterruptControlSync(_interruptBitmask: number) : void { /* Nothing to do for most chips */ } ;
  protected _writeInterruptControl(interruptBitmask: number, writeComplete: (err?: Error) => void) : void { writeComplete(); } ;

  /**
   * Enable the interrupt detection on the specified GPIO pin.
   * You can use one GPIO pin for multiple instances of the IOExpander class.
   * @param {number} gpioPin BCM number of the pin, which will be used for the interrupts from the PCF8574/8574A/PCF8575 IC.
   * @throws Error if interrupt is already enabled.
   */
  public enableInterrupt (gpioPin: number): void {
    if (this._gpio !== null) {
      throw new Error('GPIO interrupt already enabled.');
    }

    if (IOExpander._allInstancesUsedGpios[gpioPin]) {
      // use already initialized GPIO
      this._gpio = IOExpander._allInstancesUsedGpios[gpioPin];
      this._gpio['ioExpanderUseCount']++;
    } else {
      // init the GPIO as input with falling edge,
      // because the chip will lower the interrupt line on changes
      this._gpio = new Gpio(gpioPin, 'in', 'falling');
      this._gpio['ioExpanderUseCount'] = 1;
      IOExpander._allInstancesUsedGpios[gpioPin] = this._gpio;
    }
    // Enable chip interrupts for input pins.
    this._writeInterruptControlSync(this._inputPinBitmask);
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
      // Disable all chip interrupts.
      this._writeInterruptControlSync(0x00);
      // remove the interrupt handling
      this._gpio.unwatch(this._handleInterrupt);

      // decrease the use count of the GPIO and unexport it if not used anymore
      // TODO - URGENT if an interrupt is shared by multiple chip types, how do we manage that?
      // The notion of an abstract class in typescript is syntactic sugar?
      // Meaning there's one shared static object for all types?
      this._gpio['ioExpanderUseCount']--;
      if (this._gpio['ioExpanderUseCount'] === 0) {
        if (this._gpioPin !== null) {
          // delete the registered gpio from our allInstancesUsedGpios object as reference count is 0 and gpio is being unexported
          delete IOExpander._allInstancesUsedGpios[this._gpioPin];
        }
        this._gpio.unexport();
      }
      this._gpioPin = null;
      this._gpio = null;
    }
  }

  /**
   * Helper function to set/clear one bit in a bitmask.
   * @param  {number}    current The current bitmask.
   * @param  {PinNumber} pin     The bit-number in the bitmask.
   * @param  {boolean}   value   The new value for the bit. (true=set, false=clear)
   * @return {number}            The new (modified) bitmask.
   */
  private _setStatePin (current: number, pin: PinNumber, value: boolean): number {
    if (value) {
      // set the bit
      return current | 1 << (pin as number);
    } else {
      // clear the bit
      return current & ~(1 << (pin as number));
    }
  }


  /**
   * Write the current state to the IC.
   * @param  {number}  newState (optional) The new state which will be set. If omitted the current state will be used.
   * @return {Promise}          Promise which gets resolved when the state is written to the IC, or rejected in case of an error.
   */
  private _setNewState (newState?: number): Promise<void> {
    return new Promise((resolve: () => void, reject: (err: Error) => void) => {

      if (typeof (newState) === 'number') {
        this._currentState = newState;
      }

      // respect inverted with bitmask using XOR
      let newIcState = this._currentState ^ this._inverted;

      // set all input pins to high
      newIcState = newIcState | this._inputPinBitmask;

      // callback function for i2c send/write
      const processWrite = (err: Error): void => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      };

      this._writeState(newIcState, processWrite);
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
   * Internal function to poll the changes from the PCF857x IC.
   * If a change on an input is detected, an "input" Event will be emitted with a data object containing the "pin" and the new "value".
   * This is called if an interrupt occurred, or if doPoll() is called manually.
   * Additionally this is called if a new input is defined to read the current state of this pin.
   * @param {PinNumber} noEmit (optional) Pin number of a pin which should not trigger an event. (used for getting the current state while defining a pin as input)
   * @return {Promise<number>} - value representing pin states following any I2C read/write and update of the internal state.
   */
  private _poll (noEmit?: PinNumber): Promise<number> {
    if (this._currentlyPolling) {
      return Promise.reject('An other poll is in progress');
    }

    this._currentlyPolling = true;

    return new Promise((resolve: (value: number) => void, reject: (err: Error) => void) => {
      // helper functions to process errors and the read data for all IC types
      const processError = (err: Error): void => {
        this._currentlyPolling = false;
        reject(err);
      };

      const processRead = (readState: number): void => {
        this._currentlyPolling = false;
        // respect inverted with bitmask using XOR
        readState = readState ^ this._inverted;
        const currentState = this._currentState;

        // check each input for changes
        for (let pin = 0; pin < this._pins; pin++) {
          if (this._directions[pin] !== IOExpander.DIR_IN) {
            continue; // isn't an input pin
          }
          if ((this._currentState >> pin) % 2 !== (readState >> pin) % 2) {
            // pin changed
            const value: boolean = ((readState >> pin) % 2 !== 0);
            this._currentState = this._setStatePin(this._currentState, pin as PinNumber, value);
            if (noEmit !== pin) {
              this.emit('input', <IOExpander.InputData<PinNumber>>{ pin: pin, value: value });
            }
          }
        }
        if (this._currentState != currentState) {
          this.emit('poll', this._currentState);
        }
        resolve(this._currentState);
      };
      this._readState(processError, processRead);
    });
  }

  /**
   * Manually poll changed inputs from the PCF857x IC.
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
   * Write the direction and interrupt control to the IC.
   * @param  {number}  inputPinBitmask .
   * @return {Promise} Promise which gets resolved when the direction and interrupt control are written to the IC, or rejected in case of an error.
   */
  private _setDirectionAndInterruptControl(inputPinBitmask: number): Promise <void> {
    return new Promise((resolve: () => void, reject: (err: Error) => void) => {
      // If interrupts are enabled then we need to update the interrupts based on input pin bitmask.
      if (this._gpio !== null) {
        const directionResult = (err: Error) : void => {
          if (err) {
            reject(err);
          } else {
            const enableInterruptResult = (err: Error) : void => {
              if (err) {
                reject(err);
              } else {
                resolve();
              };
            };
            // 2) enable interrupts for input pins only.
            this._writeInterruptControl(inputPinBitmask, enableInterruptResult);
          }
          // 1) update directon
          this._writeDirection(inputPinBitmask, directionResult);
        }
      } else {
        // interrupts are not active so write direction only.
        const directionResult = (err: Error) : void => {
          if (err) {
            reject(err);
          } else {
            resolve();
          };
        };
        // 1) update direction
        this._writeDirection(inputPinBitmask, directionResult);
      }
    });
  }

  /**
   * Define a pin as an input.
   * This marks the pin for input processing and activates the high level on this pin.
   * @param  {PinNumber}         pin      The pin number. (0 to 7 for PCF8574/PCF8574A, 0 to 15 for PCF8575, CAT9555, and MCP23017)
   * @param  {boolean}           inverted true if this pin should be handled inverted (high=false, low=true)
   * @return {Promise}
   */
  public inputPin (pin: PinNumber, inverted: boolean): Promise<number> {
    if (pin < 0 || pin > (this._pins - 1)) {
      return Promise.reject(new Error('Pin out of range'));
    }

    this._inverted = this._setStatePin(this._inverted, pin, inverted);

    this._inputPinBitmask = this._setStatePin(this._inputPinBitmask, pin, true);

    this._directions[pin] = IOExpander.DIR_IN;

    // set the input bit mask and interrupt control.
    return this._setDirectionAndInterruptControl(this._inputPinBitmask)
      // ... and call _setNewState() to activate the high level on the input pin ...
      .then(() => this._setNewState())
      // ... and then poll all current inputs with noEmit on this pin to suppress the event
      .then(() => {
        return this._pollQueue.enqueue(() => this._poll(pin));
      });
  }


  /**
   * Define a pin as an output.
   * This marks the pin to be used as an output pin.
   * @param  {PinNumber}         pin          The pin number. (0 to 7 for PCF8574/PCF8574A, 0 to 15 for PCF8575, CAT9555, and MCP23017)
   * @param  {boolean}           inverted     true if this pin should be handled inverted (true=low, false=high)
   * @param  {boolean}           initialValue (optional) The initial value of this pin, which will be set immediately.
   * @return {Promise}
   */
  public outputPin (pin: PinNumber, inverted: boolean, initialValue?: boolean): Promise<void> {
    if (pin < 0 || pin > (this._pins - 1)) {
      return Promise.reject(new Error('Pin out of range'));
    }
    this._inverted = this._setStatePin(this._inverted, pin, inverted);

    this._inputPinBitmask = this._setStatePin(this._inputPinBitmask, pin, false);

    this._directions[pin as number] = IOExpander.DIR_OUT;

    // set the initial value only if it is defined, otherwise keep the last value (probably from the initial state)
    if (typeof (initialValue) === 'undefined') {
      return this._setDirectionAndInterruptControl(this._inputPinBitmask)
        //... and return resolved promise as nothing else need be done.
        .then(() => Promise.resolve(null));
    } else {
      return this._setDirectionAndInterruptControl(this._inputPinBitmask)
        // ... and then set the internal pin state.
        .then(() => this._setPinInternal(pin, initialValue));
    }
  }

  /**
   * Set the value of an output pin.
   * If no value is given, the pin will be toggled.
   * @param  {PinNumber} pin   The pin number. (0 to 7 for PCF8574/PCF8574A, 0 to 15 for PCF8575, CAT9555, and MCP23017)
   * @param  {boolean}   value The new value for this pin.
   * @return {Promise}
   */
  public setPin (pin: PinNumber, value?: boolean): Promise<void> {
    if (pin < 0 || pin > (this._pins - 1)) {
      return Promise.reject(new Error('Pin out of range'));
    }

    if (this._directions[pin as number] !== IOExpander.DIR_OUT) {
      return Promise.reject(new Error('Pin is not defined as output'));
    }

    if (typeof (value) == 'undefined') {
      // set value dependend on current state to toggle
      value = !((this._currentState >> (pin as number)) % 2 !== 0)
    }

    return this._setPinInternal(pin, value);
  }

  /**
   * Internal function to set the state of a pin, regardless its direction.
   * @param  {PinNumber} pin   The pin number. (0 to 7 for PCF8574/PCF8574A, 0 to 15 for PCF8575, CAT9555, and MCP23017)
   * @param  {boolean}   value The new value.
   * @return {Promise}
   */
  private _setPinInternal (pin: PinNumber, value: boolean): Promise<void> {
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
      if (this._directions[pin] !== IOExpander.DIR_OUT) {
        continue; // isn't an output pin
      }
      newState = this._setStatePin(newState, pin as PinNumber, booleanValue ? value : ((value & (1 << pin)) !== 0));
    }
    return this._setNewState(newState);
  }

  /**
   * Returns the current value of a pin.
   * This returns the last saved value, not the value currently returned by the IO Chip.
   * To get the current value call doPoll() first, if you're not using interrupts.
   * @param  {PinNumber} pin The pin number. (0 to 7 for PCF8574/PCF8574A, 0 to 15 for PCF8575, CAT9555, and MCP23017)
   * @return {boolean}       The current value.
   */
  public getPinValue (pin: PinNumber): boolean {
    if (pin < 0 || pin > (this._pins - 1)) {
      return false;
    }
    return ((this._currentState >> (pin as number)) % 2 !== 0)
  }
}