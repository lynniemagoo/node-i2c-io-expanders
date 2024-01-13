/*
 * Node.js PCF8574/PCF8574A
 *
 * Copyright (c) 2017-2023 Peter Müller <peter@crycode.de> (https://crycode.de)
 *
 * Node.js module for controlling each pin of a PCF8574/PCF8574A I2C port expander IC.
 */
import { I2CBus } from 'i2c-bus';

import { IOExpander } from './ioExpander';

/**
 * Namespace for types for PCF8574
 */
export namespace PCF8574 {
  /**
   * A pin number from 0 to 7
   * @type {number}
   */
  export type PinNumber = IOExpander.PinNumber8;

  /**
   * Possible pin directions.
   * 0 = out, 1 = in, -1 = undefined
   */
  export type PinDirection = IOExpander.PinDirection;

  /**
   * Data of an 'input' event
   * @type {Object}
   */
  export type InputData = IOExpander.InputData<PinNumber>;
}

/**
 * Class for handling a PCF8574/PCF8574A IC.
 */
export class PCF8574 extends IOExpander<IOExpander.PinNumber8> {

  /** Number of pins the IC has. */
  protected _pins = <const>8;

  /**
   * Constructor for a new PCF8574 instance.
   * If you use this IC with one or more input pins, you have to call ...
   *  a) enableInterrupt(gpioPin) to detect interrupts from the IC using a GPIO pin, or
   *  b) doPoll() frequently enough to detect input changes with manually polling.
   * @param  {I2cBus}         i2cBus       Instance of an opened i2c-bus.
   * @param  {number}         address      The address of the PCF8574 IC.
   */
  constructor (i2cBus: I2CBus, address: number) {
    super(i2cBus, address);
  }

  protected _initializeChip () : Promise<void> {
    return this._writeChip(2, this._currentState);
  }

  /*
  _initializeChipSync (initialState: number, _inputPinBitmask: number) : void {
    this._i2cBus.i2cWriteSync(this._address, 1, Buffer.from([initialState & 0xFF]));
  }
  */

  protected _readState () : Promise<number> {
    return this._readChip(1);
  }

  protected _writeState (state: number) : Promise<void> {
    return this._writeChip(1, state);
  }
}