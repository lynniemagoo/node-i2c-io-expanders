/*
 * Node.js I2C io expanders
 *
 * Copyright (c) 2017-2024 Peter Müller <peter@crycode.de> (https://crycode.de)
 *               2022-2024 Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of an I2C port expander IC.
 */

import { EventEmitter } from 'events';
import { I2CBus } from 'i2c-bus';
import { Gpio } from 'onoff';
import { PromiseQueue } from './promise-queue';

/**
 * Namespace for the common class IOExpander.
 */
export namespace IOExpander {

  /**
   * A pin number from 0 to 7 for PCF8574/PCF8574A.
   * @type {number}
   */
  export type PinNumber8 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

  /**
   * A pin number from 0 to 15 for PCF8575, CAT9555, or MCP23017.
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

  /**
   * Internal store to track GPIO usage.
   */
  export interface UsedGpioData {
    /**
     * The GPIO instance.
     */
    gpio: Gpio;

    /**
     * Counter how often this GPIO is used.
     */
    useCount: number;
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
   * Emit an interrupt event.
   * @param event 'interrupt'
   * @param processed boolean 'true' if interrupt was processed or 'false' if processing failed.
   */
  emit (event: 'interrupt', processed: boolean ): boolean;

  /**
   * Emitted when an interrupt has completed.
   * @param event 'interrupt'
   * @param listener Eventlistener with a boolean containing the state of the interrupt processing.
   */
  on (event: 'interrupt', listener: (processed: boolean) => void): this;
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

  /** Object containing all GPIOs used by any instance. */
  private static _allInstancesUsedGpios: Record<number, IOExpander.UsedGpioData> = {};

  /** The instance of the i2c-bus, which is used for the I2C communication. */
  protected _i2cBus: I2CBus;

  /** The address of the IC. */
  protected _address: number;

  /** Number of pins the IC has. */
  protected abstract _pins: 8 | 16;

  /** Direction of each pin. By default all pin directions are undefined. */
  protected _directions: Array<IOExpander.PinDirection>;

  /** Bitmask for all input pins. Used to set all input pins to high on the IC. */
  protected _inputPinBitmask: number = 0;

  /** Bitmask for inverted pins. */
  protected _inverted: number;

  /** Bitmask representing the current state of the pins. */
  protected _currentState: number;

  /** Flag if we are currently polling changes from the IC. */
  private _currentlyPolling: boolean = false;

  /** PromiseQueue to handle requested I2C actions in order. */
  private _queue: PromiseQueue = new PromiseQueue();

  /** Number of polls currently active */
  private _pollCount: number = 0;

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
   * @param  {number}         address      The address of the IC.
   */
  constructor (i2cBus: I2CBus, address: number) {
    super();

    // LRM - My style preference is to do a bind of a static class method
    //       Here, we're updating an instance method with a bound version
    //       from the prototype.
    // bind the _handleInterrupt method strictly to this instance
    this._handleInterrupt = this._handleInterrupt.bind(this);

    this._i2cBus = i2cBus;

    // check the given address
    if (address < 0 || address > 255) {
      throw new Error('Address out of range');
    }
    this._address = address;

    // nothing inverted by default
    this._inverted = 0;

    // full init is done in the `initialize()` method
  }

  /**
   * Asynchronously initialize the chip post construction.
   * @param  {boolean|number} initialState The initial state of the pins of this IC. You can set a bitmask to define each pin separately, or use true/false for all pins at once.
   * @return {Promise} Promise which gets resolved when done, or rejected in case of an error.
   */
  // LRM  - I question the usefulness of initialState as a number.  This is because the number supplied must
  //        also include a mask for inversion of pins which is not known until inputPin or outputPin is called.
  //        My thoughts would be to eliminate this parameter and always default initialState to all 1's which is the state that
  //        a chip will be in following reset.
  public async initialize (initialState: boolean | number): Promise<void> {
    // set pin directions to undefined
    this._directions = new Array(this._pins).fill(IOExpander.DIR_UNDEF);

    if (initialState === true) {
      initialState = Math.pow(2, this._pins) - 1;
    } else if (initialState === false) {
      initialState = 0;
    } else if (typeof (initialState) !== 'number' || initialState < 0 || initialState > Math.pow(2, this._pins) - 1) {
      throw new Error('InitialState bitmask out of range');
    }
    // Save the initial state as current state for write to the IC during _initializeChip.
    this._currentState = initialState;

    // All IOChips below following reset define all pins as input
    // PCF8574 Page 1 of datasheet - all pins are high at power on meaning they can be used as inputs
    // PCF8575 Page 1 of datasheet - all pins are high at power on meaning they can be used as inputs
    // CAT9555 Page 10 of datasheet - The default values of the Configuration Port0/Configuration Port1 registers are all 1's meaning all 16 pins are input by default.
    // MCP2017 Page 16 of datasheet - The default values of IODIRA/IODIRB are all 1's meaning all 16 pins are input by default.
    this._inputPinBitmask = Math.pow(2, this._pins) - 1;

    return this._initializeChip();
  }

  /**
   * Make a clean shutdown.
   *
   * This will:
   * - remove all event listeners
   * - disable the interrupt, if used
   *
   * @return {Promise} Promise which gets resolved when done.
   */
  public async close (): Promise<void> {
    this.removeAllListeners();
    await this.disableInterrupt();
  }

  /**
   * Helper method to read an 8 or 16 bit value from the IC.
   * @param  {number}  Count of types to read.  1 or 2
   * @param  {boolean} If count is 2, optional boolean that determines if first byte read is the msb of a 16 bit value.  Default is false.  Ignored if count === 1
   * @return {Promise} Promise which gets resolved with the 8 or 16 bit value is read from the chip, or rejected in case of an error.
   */
  protected _readChip (byteCount: 1 | 2, msbFirst?: boolean) : Promise<number> {
    return new Promise<number>((resolve: (chipState: number) => void, reject: (err: Error) => void) => {
      this._i2cBus.i2cRead(this._address, byteCount, Buffer.alloc(byteCount), (err, bytesRead, buffer) => {
        if (err || bytesRead !== byteCount) {
          reject(err);
        } else {
          if (byteCount === 2) {
            // Readstate is 16 bits.
            // if msb then buffer[0] is msb of 16 bit value.  otherwise, buffer[1] is msb of 16 bit value.
            resolve(!!msbFirst ? (buffer[0] << 8) | buffer[1] : buffer[0] | (buffer[1] << 8));
          } else {
            resolve(buffer[0]);
          }
        }
      });
    });
  }

  /**
   * Helper method to read an 8 or 16 bit value from the IC.
   * @param  {number}  Register of the chip that is target of the write.
   * @param  {number}  Count of types to read.  1 or 2
   * @param  {boolean} If count is 2, optional boolean that determines if first byte read is the msb of a 16 bit value.  Default is false.  Ignored if count === 1
   * @return {Promise} Promise which gets resolved with the 8 or 16 bit value is read from the chip, or rejected in case of an error.
   */
  protected _readChipRegister (register: number, byteCount: 1 | 2, msbFirst?: boolean) : Promise<number> {
    return new Promise<number>((resolve: (chipState: number) => void, reject: (err: Error) => void) => {
      this._i2cBus.readI2cBlock(this._address, register & 0xFF, byteCount, Buffer.alloc(byteCount), (err, bytesRead, buffer) => {
        if (err || bytesRead !== byteCount) {
          reject(err);
        } else {
          if (byteCount === 2) {
            // Readstate is 16 bits.
            // if msbFirst then buffer[0] is msb of 16 bit value.  otherwise, buffer[1] is msb of 16 bit value.
            resolve(!!msbFirst ? ((buffer[0] << 8) | buffer[1]) : (buffer[0] | (buffer[1] << 8)));
          } else {
            resolve(buffer[0]);
          }
        }
      });
    });
  }

  /**
   * Helper method to write an 8 or 16 bit value to the IC.
   * @param  {number}  Register of the chip that is target of the write.
   * @param  {number}  Count of types to write.  1 or 2
   * @param  {number}  8 or 16 bit value to write (bit count determined by byteCount).
   * @param  {boolean} If count is 2, optional boolean that determines if first byte written is the msb of a 16 bit value.  Default is false.  Ignored if count === 1
   * @return {Promise} Promise which gets resolved when the 8 or 16 bit value is written to the chip, or rejected in case of an error.
   */
  protected _writeChipRegister (register: number, byteCount: 1 | 2, value: number, msbFirst?: boolean) : Promise<void> {
    return new Promise<void>((resolve: () => void, reject: (err: Error) => void) => {
      let arr: number[];
      if (byteCount === 2) {
        arr = !!msbFirst ? [(value >> 8) & 0xFF, value & 0xFF] : [value & 0xFF, (value >> 8) & 0xFF];
      } else {
        arr = [value & 0xFF];
      }
      this._i2cBus.writeI2cBlock(this._address, register & 0xFF, byteCount, Buffer.from(arr), (err, bytesWritten) => {
        if (err || bytesWritten !== byteCount) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Helper method to write an 8 or 16 bit value to the IC.
   * @param  {number}  Count of types to write.  1 or 2
   * @param  {number}  8 or 16 bit value to write (bit count determined by byteCount).
   * @param  {boolean} If count is 2, optional boolean that determines if first byte written is the msb of a 16 bit value.  Default is false.  Ignored if count === 1
   * @return {Promise} Promise which gets resolved when the 8 or 16 bit value is written to the chip, or rejected in case of an error.
   */
  protected _writeChip (byteCount: 1 | 2, value: number, msbFirst?: boolean) : Promise<void> {
    return new Promise<void>((resolve: () => void, reject: (err: Error) => void) => {
      let arr: number[];
      if (byteCount === 2) {
        arr = !!msbFirst ? [(value >> 8) & 0xFF, value & 0xFF] : [value & 0xFF, (value >> 8) & 0xFF];
      } else {
        arr = [value & 0xFF];
      }
      this._i2cBus.i2cWrite(this._address, byteCount, Buffer.from(arr), (err, bytesWritten) => {
        if (err || bytesWritten !== byteCount) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Initialize the IC.
   * All chips require this method.
   * @return {Promise} Promise which gets resolved when done, or rejected in case of an error.
   */
  protected abstract _initializeChip () : Promise<void>;

  /**
   * Read the pin state from the IC.
   * All chips require this method.
   * @return {Promise} Promise which gets resolved with the 8 or 16 bit value is read from the chip, or rejected in case of an error.
   */
  protected abstract _readState () : Promise<number>;

  /**
   * Write the internal state to the IC.
   * All chips require this method.
   * @param  {number}  state.
   * @return {Promise} Promise which gets resolved when the state is written to the IC, or rejected in case of an error.
   */
  protected abstract _writeState (state: number) : Promise<void>;

  /**
   * Write the pin direction assignment to the IC.
   * Chips that require this must override this method.
   * @param  {number}  inputPinBitmask.
   * @return {Promise} Promise which gets resolved when the direction is written to the IC, or rejected in case of an error.
   */
  protected _writeDirection (_inputPinBitmask: number) : Promise<void> { return Promise.resolve(); }

  /**
   * Write the interrupt control to the IC.
   * Chips that require this must override this method.
   * Note: Currently we use the inputPinBitmask for interruptBitmask.  This means that any pin marked as input will be configured for interrupts.
   * @param  {number}  interruptBitmask.
   * @return {Promise} Promise which gets resolved when the interrupt control is written to the IC, or rejected in case of an error.
   */
  protected _writeInterruptControl (_interruptBitmask: number) : Promise<void> { return Promise.resolve(); }

  /**
   * Enable the interrupt detection on the specified GPIO pin.
   * You can use one GPIO pin for multiple instances of the IOExpander class.
   * @param {number} gpioPin BCM number of the pin, which will be used for the interrupts from the PCF8574/8574A/PCF8575 IC.
   * @return {Promise}          Promise which gets resolved when complete, or rejected in case of an error.
   */
  public async enableInterrupt (gpioPin: number): Promise<void> {
    if (this._gpio !== null) {
      // Must first call disable if previously enabled.
      // throw new Error('GPIO interrupt already enabled.');
      return Promise.reject(new Error('GPIO interrupt already enabled.'));
    }

    if (IOExpander._allInstancesUsedGpios[gpioPin]) {
      // Already initialized GPIO
      this._gpio = IOExpander._allInstancesUsedGpios[gpioPin].gpio;
      IOExpander._allInstancesUsedGpios[gpioPin].useCount++;
    } else {
      // Init the GPIO as input with falling edge,
      // because the chip will lower the interrupt line on changes
      this._gpio = new Gpio(gpioPin, 'in', 'falling');
      IOExpander._allInstancesUsedGpios[gpioPin] = {
        gpio: this._gpio,
        useCount: 1
      };
    }

    // Enable chip interrupts for input pins.
    await this._writeInterruptControl(this._inputPinBitmask);

    // cache this value so we can properly nullify entry in static_allInstancesUsedGpios object during disableInterrupt calls.
    this._gpioPin = gpioPin;
    this._gpio.watch(this._handleInterrupt);
  }

  /**
   * Internal function to handle a GPIO interrupt.
   */
  private _handleInterrupt (): void {
    // Request a poll of current state.
    // When poll is serviced, notify listeners that a 'processed' interrupt occurred.
    // When not queued or poll fails, notify listeners of an 'unprocessed' interrupt.
    this._requestPoll()
      .then(() => this.emit('interrupt', true))
      .catch(() => this.emit('interrupt', false));
  }

  /**
   * Disable the interrupt detection.
   * This will unexport the interrupt GPIO, if it is not used by an other instance of this class.
   * @return {Promise}          Promise which gets resolved when complete, or rejected in case of an error.
   */
  public async disableInterrupt (): Promise<void> {
    if (this._gpio === null) {
      // Nothing to do.
      return;
    }

    // Disable all chip interrupts.
    await this._writeInterruptControl(0x00);

    // remove the interrupt handling
    this._gpio.unwatch(this._handleInterrupt);

    // Release the used GPIO
    // Decrease the use count of the GPIO and unexport it if not used anymore
    if (IOExpander._allInstancesUsedGpios[this._gpioPin]) {
      IOExpander._allInstancesUsedGpios[this._gpioPin].useCount--;
      if (IOExpander._allInstancesUsedGpios[this._gpioPin].useCount === 0) {
        // Delete the registered gpio from our allInstancesUsedGpios object as reference count is 0 and gpio is being unexported
        delete IOExpander._allInstancesUsedGpios[this._gpioPin];
        this._gpio.unexport();
      }
    }
    this._gpioPin = this._gpio = null;
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
   * @param  {array}  pinUpdates (optional) Array containing PinUpdate objects to use to mutate pin bits in current state.
   * @return {Promise}          Promise which gets resolved when the state is written to the IC, or rejected in case of an error.
   */
  private _setNewState (pinUpdates?: IOExpander.PinUpdate[]): Promise<void> {
    // To avoid races, ensure access and mutation of this._currentState are ordered via a queue.
    return this._queue.enqueue(async () => {
      // mutate only the pin bits that were requested.
      if (Array.isArray(pinUpdates)) {
        for (let i=0; i< pinUpdates.length; i++) {
          const pinUpdate = pinUpdates[i];
          // Toggle, Set, or Reset pin based on state requested.
          const state: boolean = (pinUpdate.pinState === IOExpander.PinState.Toggle) ? !(((this._currentState >> pinUpdate.pin) % 2) != 0) : (pinUpdate.pinState === IOExpander.PinState.On);
          this._currentState = this._setStatePin(this._currentState, pinUpdate.pin as PinNumber, state);
        }
      }

      // respect inverted with bitmask using XOR
      let newIcState = this._currentState ^ this._inverted;

      // set all input pins to high
      newIcState = newIcState | this._inputPinBitmask;

      await this._writeState(newIcState);
    });
  }

  /**
   * Returns if one or multiple polls are currently active.
   * @returns `true` if we are currently polling.
   */
  public isPolling (): boolean {
    return this._pollCount != 0;
  }

  /**
   * Internal function to poll the changes from the IC.
   * If a change on an input is detected, an "input" Event will be emitted with a data object containing the "pin" and the new "value".
   * This is called if an interrupt occurred, or if doPoll() is called manually.
   * Additionally this is called if a new input is defined to read the current state of this pin.
   * @param {PinNumber | null} noEmit (optional) Pin number of a pin which should not trigger an event. (used for getting the current state while defining a pin as input)
   * @return {Promise<number>} - value representing pin states following any I2C read/write and update of the internal state.
   */
  private async _poll (noEmit?: PinNumber | null): Promise<number> {
    // To avoid races, ensure access and mutation of this._currentState are ordered via a queue.
    return this._queue.enqueue(async () => {
      if (this._currentlyPolling) {
        throw new Error('An other poll is in progress');
      }

      this._currentlyPolling = true;

      try {
        let readState: number = await this._readState();

        // Process data read from chip and notify input pins of changes.
        this._currentlyPolling = false;
        // respect inverted with bitmask using XOR
        readState = readState ^ this._inverted;

        // Calculate exactly which pins have changed and then remove pin bits for pins that are not inputs.
        // this._currentState XOR readState gives us 1 bits for pins that changed.
        // then we AND this with the inputPinBitMask to reflect only pins that are inputs at chip-level..
        const inputPinsThatChanged: number = (this._currentState ^ readState) & this._inputPinBitmask;

        // If no input pins have changed
        // Don't loop unless we detect them.
        if (inputPinsThatChanged !== 0) {
          for (let pin = 0; pin < this._pins; pin++) {
            // inputPinsThatChanged indeed contains input pins but maybe some of these have not been assigned for use via inputPin().
            // Therefore, we must also check this._directions[pin] because we don't want to fire events for pins that application
            // does not want to monitor.
            if ((this._directions[pin] === IOExpander.DIR_IN) && ((inputPinsThatChanged >> pin) % 2)) {
              const value: boolean = ((readState >> pin) % 2 !== 0);
              this._currentState = this._setStatePin(this._currentState, pin as PinNumber, value);
              if (noEmit !== pin) {
                this.emit('input', <IOExpander.InputData<PinNumber>>{ pin: pin, value: value });
              }
            }
          }
        }
        return this._currentState;
      } catch (err) {
        this._currentlyPolling = false;
        throw err;
      }
    });
  }

  /**
   * Request a poll to read pin values from the IC.
   * Normally, there can be up to 3 + number of pins on IC polls active at one time.
   * When trying to request a poll if already the max limit of polls active, the Promise will be rejected.
   * @param {PinNumber | null} noEmit (optional) Pin number of a pin which should not trigger an event. (used for getting the current state while defining a pin as input)
   * @param {boolean} ignoreMaxPollCount Ignore the maximum limit of polls that can be active at same time.
   * @returns {Promise<number>} Promise resolving to the pin states after successfull poll.
   */
  private async _requestPoll (noEmit?: PinNumber | null, ignoreMaxPollCount?: boolean): Promise<number> {
    if (!ignoreMaxPollCount && this._pollCount >= (3 + this._pins)) {
      throw new Error('Too many polls currently active');
    }

    this._pollCount++;
    let v: number;
    try {
      v = await this._poll(noEmit);
    } catch (err) {
      throw err;
    }
    finally {
      this._pollCount--;
    }
    return v;
  }

  /**
   * Manually poll changed inputs from the IC.
   * If a change on an input is detected, an "input" Event will be emitted with a data object containing the "pin" and the new "value".
   * This function has to be called frequently enough if you don't use a GPIO for interrupt detection.
   * If you poll again before the last poll was completed, the new poll will be queued up the be executed after the current poll.
   * Normally, there can be up to 3 + number of pins on IC polls active at one time.
   * @param {boolean} ignoreMaxPollCount Ignore the maximum limit of polls in queue and request a poll anyways.
   * @return {Promise<number>} - value representing pin states following any I2C read/write and update of the internal state.
   */
  public doPoll (ignoreMaxPollCount?: boolean): Promise<number> {
    return this._requestPoll(null, ignoreMaxPollCount);
  }

  /**
   * Define a pin as an input.
   * This marks the pin for input processing and activates the high level on this pin.
   * @param  {PinNumber}         pin      The pin number. (0 to 7 for PCF8574/PCF8574A, 0 to 15 for PCF8575, CAT9555, and MCP23017)
   * @param  {boolean}           inverted true if this pin should be handled inverted (high=false, low=true)
   * @return {Promise}
   */
  public async inputPin (pin: PinNumber, inverted: boolean): Promise<number> {
    if (pin < 0 || pin > (this._pins - 1)) {
      throw new Error('Pin out of range');
    }

    this._inverted = this._setStatePin(this._inverted, pin, inverted);

    this._inputPinBitmask = this._setStatePin(this._inputPinBitmask, pin, true);

    this._directions[pin] = IOExpander.DIR_IN;

    // set the input bit mask
    await this._writeDirection(this._inputPinBitmask);
    // ... and then write interrupt control flags if required
    await this._writeInterruptControl(this._inputPinBitmask);
    // ... and call _setNewState() to activate the high level on the input pin ...
    await this._setNewState();
    // ... and then _poll all current inputs with noEmit on this pin to suppress the event
    return this._requestPoll(pin, true);
  }

  /**
   * Define a pin as an output.
   * This marks the pin to be used as an output pin.
   * @param  {PinNumber}         pin          The pin number. (0 to 7 for PCF8574/PCF8574A, 0 to 15 for PCF8575, CAT9555, and MCP23017)
   * @param  {boolean}           inverted     true if this pin should be handled inverted (true=low, false=high)
   * @param  {boolean}           initialValue (optional) The initial value of this pin, which will be set immediately.
   * @return {Promise}
   */
  public async outputPin (pin: PinNumber, inverted: boolean, initialValue?: boolean): Promise<void> {
    if (pin < 0 || pin > (this._pins - 1)) {
      throw new Error('Pin out of range');
    }

    this._inverted = this._setStatePin(this._inverted, pin, inverted);

    this._inputPinBitmask = this._setStatePin(this._inputPinBitmask, pin, false);

    this._directions[pin as number] = IOExpander.DIR_OUT;

    // set the initial value only if it is defined, otherwise keep the last value (probably from the initial state)
    if (typeof (initialValue) === 'undefined') {
      // set the input bit mask
      await this._writeDirection(this._inputPinBitmask);
      // ... and then write interrupt control flags if required
      await this._writeInterruptControl(this._inputPinBitmask);
    } else {
      // set the input bit mask
      await this._writeDirection(this._inputPinBitmask);
      // ... and then write interrupt control flags if required
      await this._writeInterruptControl(this._inputPinBitmask);
      // ... and then set the internal pin state.
      await this._setPinInternal(pin, initialValue ? IOExpander.PinState.On : IOExpander.PinState.Off);
    }
  }

  /**
   * Set the value of an output pin.
   * If no value is given, the pin will be toggled.
   * @param  {PinNumber} pin   The pin number. (0 to 7 for PCF8574/PCF8574A, 0 to 15 for PCF8575, CAT9555, and MCP23017)
   * @param  {boolean}   value The new value for this pin.
   * @return {Promise}
   */
  public async setPin (pin: PinNumber, value?: boolean): Promise<void> {
    if (pin < 0 || pin > (this._pins - 1)) {
      throw new Error('Pin out of range');
    }

    if (this._directions[pin as number] !== IOExpander.DIR_OUT) {
      throw new Error('Pin is not defined as output');
    }

    return this._setPinInternal(pin, (typeof (value) == 'undefined') ? IOExpander.PinState.Toggle : (value ? IOExpander.PinState.On : IOExpander.PinState.Off));
  }

  /**
   * Internal function to set the state of a pin.
   * @param  {PinNumber} pin   The pin number. (0 to 7 for PCF8574/PCF8574A, 0 to 15 for PCF8575, CAT9555, and MCP23017)
   * @param  {PinState}  state The state to set for the pin
   * @return {Promise}
   */
  private _setPinInternal (pin: PinNumber, pinState: IOExpander.PinState): Promise<void> {
    return this._setNewState([{pin, pinState}]);
  }

  /**
   * Set the given value to all output pins if boolean or sets output pins based on bits with value if a number.
   * @param  {boolean | number} value The new value for all output pins.
   * @return {Promise}
   */
  public async setAllPins (value: boolean | number): Promise<void> {
    if (this._directions.indexOf(IOExpander.DIR_OUT) < 0) {
      // Nothing to do.
      return;
    }

    const pinUpdates: IOExpander.PinUpdate[] = [];
    const booleanValue = typeof (value) === 'boolean';
    for (let pin = 0; pin < this._pins; pin++) {
      if (this._directions[pin] == IOExpander.DIR_OUT) {
        // Push pin update with specified state
        pinUpdates.push({pin, pinState:(booleanValue ? value : ((value & (1 << pin)) !== 0)) ? IOExpander.PinState.On : IOExpander.PinState.Off});
      }
    }
    return  this._setNewState(pinUpdates);
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

export namespace IOExpander {
  /**
   * Internal enum to specify state to apply during update
   */
  export enum PinState {
    Off,
    On,
    Toggle
  }

  /**
   * Internal structure to track pins to set and state for pin.
   */
  export interface PinUpdate {
    /**
     * The pin number.
     */
    pin: number;

    /**
     * State to set for the pin. - Off, On, or Toggle
     */
    pinState: PinState;
  }
}