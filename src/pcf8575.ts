/*
 * Node.js PCF8575
 *
 * Copyright (c) 2017-2023 Peter Müller <peter@crycode.de> (https://crycode.de)
 *               2022 - PCF8575 support inspired by Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a PCF8575 I2C port expander IC.
 */
import { I2CBus } from 'i2c-bus';

import { IOExpander } from './ioExpander';

/**
 * Namespace for types for PCF8575
 */

export namespace PCF8575 {
  /**
   * A pin number from 0 to 15
   * @type {number}
   */
  export type PinNumber = IOExpander.PinNumber16;

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
 * Class for handling a PCF8575 IC.
 */
export class PCF8575 extends IOExpander<IOExpander.PinNumber16> {

  /**
   * Constructor for a new PCF8575 instance.
   * If you use this IC with one or more input pins, you have to call ...
   *  a) enableInterrupt(gpioPin) to detect interrupts from the IC using a GPIO pin, or
   *  b) doPoll() frequently enough to detect input changes with manually polling.
   * @param  {I2cBus}         i2cBus       Instance of an opened i2c-bus.
   * @param  {number}         address      The address of the PCF8575 IC.
   * @param  {boolean|number} initialState The initial state of the pins of this IC. You can set a bitmask to define each pin seprately, or use true/false for all pins at once.
   */
  constructor (i2cBus: I2CBus, address: number, initialState: boolean | number) {
    super(i2cBus, address, initialState, 16);
  }

  _initializeChipSync (initialState: number, _inputPinBitmask: number) : void {
    this._i2cBus.i2cWriteSync(this._address, 2, Buffer.from([initialState & 0xFF, (initialState >>> 8) & 0xFF]));
  }

  _readState () : Promise<number> {
    return new Promise((resolve: (chipState: number) => void, reject: (err: Error) => void) => {
      this._i2cBus.i2cRead(this._address, 2, Buffer.alloc(2), (err: Error, bytesRead: number, buffer: Buffer) => {
        if (err || bytesRead !== 2) {
          reject(err);
        } else {
          // Readstate is 16 bit reverse of byte ordering.  Pins 0-7 are in byte 0.  Pins 8-15 are in byte 1.
          resolve(buffer[0] | (buffer[1] << 8));
        }
      });
    });
  }

  _writeState (state: number) : Promise<void> {
    return new Promise((resolve: () => void, reject: (err: Error) => void) => {
      this._i2cBus.i2cWrite(this._address, 2, Buffer.from([state & 0xFF, (state >>> 8) & 0xFF]), (err, bytesWritten) => {
        if (err || (bytesWritten != 2)) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}