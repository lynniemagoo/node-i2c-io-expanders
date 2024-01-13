/*
 * Node.js CAT9555
 *
 * Copyright (c) 2023 Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a CAT9555 I2C port expander IC.
 */
import { I2CBus } from 'i2c-bus';

import { IOExpander } from './ioExpander';

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
 * Class for handling a CAT9555 IC.
 */
export class CAT9555 extends IOExpander<IOExpander.PinNumber16> {

  /** Number of pins the IC has. */
  protected _pins = <const>16;

  /**
   * Constructor for a new CAT9555 instance.
   * If you use this IC with one or more input pins, you have to call ...
   *  a) enableInterrupt(gpioPin) to detect interrupts from the IC using a GPIO pin, or
   *  b) doPoll() frequently enough to detect input changes with manually polling.
   * @param  {I2cBus}         i2cBus       Instance of an opened i2c-bus.
   * @param  {number}         address      The address of the CAT9555 IC.
   */
  constructor (i2cBus: I2CBus, address: number) {
    super(i2cBus, address);
  }

  protected async _initializeChip () : Promise<void> {
    // On startup, Force no Polarity Invert as we will manage this in software with the _inverted bitField.
    await this._writeChipRegister(CAT9555_REGISTERS.POL_INV_0, 2, 0x00);
    // Set pins marked as input.
    await this._writeChipRegister(CAT9555_REGISTERS.CON_PORT_0, 2, this._inputPinBitmask);
    // Write the initial state which should have no effect as all ports set as input but ensures output register is set appropriately.
    await this._writeChipRegister(CAT9555_REGISTERS.OUTPUT_PORT_0, 2, this._currentState);
  }

  /*
  _initializeChipSync (initialState: number, inputPinBitmask: number) : void {

    // On startup, Force no Polarity Invert as we will manage this in software with the _inverted bitField.
    this._i2cBus.writeI2cBlockSync(this._address, CAT9555_REGISTERS.POL_INV_0, 2, Buffer.from([0x00, 0x00]));

    this._i2cBus.writeI2cBlockSync(this._address, CAT9555_REGISTERS.CON_PORT_0, 2, Buffer.from([inputPinBitmask & 0xFF, (inputPinBitmask >> 8) & 0xFF]));

    // On startup, Write the initial state which should have no effect as all ports set as input but ensures output register is set appropriately.
    this._i2cBus.writeI2cBlockSync(this._address, CAT9555_REGISTERS.OUTPUT_PORT_0, 2, Buffer.from([initialState & 0xFF, (initialState >> 8) & 0xFF]));
  }
  */

  protected _readState () : Promise<number> {
    return this._readChipRegister(CAT9555_REGISTERS.INPUT_PORT_0, 2);
  }

  protected _writeState (state: number) : Promise<void> {
    return this._writeChipRegister(CAT9555_REGISTERS.OUTPUT_PORT_0, 2, state);
  }

  protected _writeDirection (inputPinBitmask: number) : Promise<void> {
    return this._writeChipRegister(CAT9555_REGISTERS.CON_PORT_0, 2, inputPinBitmask);
  }
}