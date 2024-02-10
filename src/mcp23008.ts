/*
 * Node.js MCP23008
 *
 * Copyright (c) 2023-2024 Lyndel McGee <lynniemagoo@yahoo.com>
 *               2023-2024 Peter Müller <peter@crycode.de> (https://crycode.de)
 *
 * Node.js module for controlling each pin of a MCP23008 I2C port expander IC.
 */
import { I2CBus } from 'i2c-bus';

import { IOExpander } from './ioExpander';

// By annotating an enum option, you set the value;
// increments continue from that value:

enum MCP23008_IOCON_FLAGS {
  DEFAULT = 0x00,
  /*
  SEQ_OP_ENABLE = 0x00,
  SDA_SLEW_ENABLED = 0x00,
  MCP23S08_HW_ADDR_DISABLED = 0x00,
  INT_OPEN_DRAIN_DISABLED = 0x00,
  INT_POLARITY_LOW = 0x00,
  */
  SEQ_OP_DISABLE = 0x20,
  SDA_SLEW_DISABLED = 0x10,
  MCP23S08_HW_ADDR_ENABLED = 0x08,
  INT_OPEN_DRAIN_ENABLED = 0x04,
  INT_POLARITY_HIGH = 0x02
}

// These are Bank0 mappings (see datasheet for bank 1)
enum MCP23008_REGISTERS {
  IODIR = 0x00, // IO direction- 1= input 0 = output

  // Input polarity - If a bit is set, the corresponding GPIO register bit
  // will reflect the inverted value on the pin.
  IPOL = 0x01,

  // The GPINTEN register controls the interrupt-onchange feature for each
  // pin on port.
  GPINTEN = 0x02,

  // Default value for port - These bits set the compare value for pins
  // configured for interrupt-on-change.  If the associated pin level is the
  // opposite from the register bit, an interrupt occurs.
  DEFVAL = 0x03,

  // Interrupt control register for port.  If 1 interrupt is fired when the
  // pin matches the default value, if 0 the interrupt is fired on state
  // change
  INTCON = 0x04,

  IOCON = 0x05, // see datasheet for configuration register

  GPPU = 0x06, // pull-up resistors for port

  // The INTF register reflects the interrupt condition on the port pins of
  // any pin that is enabled for interrupts. A set bit indicates that the
  // associated pin caused the interrupt.
  INTF = 0x07,

  // The INTCAP register captures the GPIO port value at the time the
  // interrupt occurred.
  INTCAP = 0x08,

  GPIO = 0x09, // Data port
  OLAT = 0x0A // Output latches
}

/**
 * Namespace for types for MCP23008
 */
export namespace MCP23008 {
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
 * Class for handling a MCP23008 IC.
 */
export class MCP23008 extends IOExpander<IOExpander.PinNumber8> {

  /** Number of pins the IC has that are to be exposed PortA has 8 pins and PortB has 8 pins. */
  protected _pins = <const>8;

  /**
   * Constructor for a new MCP23017 instance for pins on Port A.
   * If you use this IC with one or more input pins, you have to call ...
   *  a) enableInterrupt(gpioPin) to detect interrupts from the IC using a GPIO pin, or
   *  b) doPoll() frequently enough to detect input changes with manually polling.
   * @param  {I2cBus}         i2cBus       Instance of an opened i2c-bus.
   * @param  {number}         address      The address of the MCP23017 IC.
   */
  constructor (i2cBus: I2CBus, address: number) {
    super(i2cBus, address);
  }

  protected async _initializeChip (initialHardwareState: number) : Promise<void> {
    // On startup, Default chip config to use Bank 0 with Open-Drain (Active Low) interrupts
    const ioconFlags =
      MCP23008_IOCON_FLAGS.DEFAULT |
      MCP23008_IOCON_FLAGS.INT_OPEN_DRAIN_ENABLED;

    await this._writeChipRegister(MCP23008_REGISTERS.IOCON, 1, ioconFlags);
    // Disable all interrupts.
    await this._writeChipRegister(MCP23008_REGISTERS.GPINTEN, 1, 0x00);
    // Set pins marked as input.
    await this._writeChipRegister(MCP23008_REGISTERS.IODIR, 1, this._inputPinBitmask);
    // Force all pins to Pull-Up.
    await this._writeChipRegister(MCP23008_REGISTERS.GPPU, 1, 0xFF);
    // Force no Polarity Invert as we will manage this in software with the _inverted bitField.
    await this._writeChipRegister(MCP23008_REGISTERS.IPOL, 1, 0x00);
    // Set interrupt change default values to 0.
    await this._writeChipRegister(MCP23008_REGISTERS.INTCON, 1, 0x00);
    // Write the initial state which should have no effect as all ports set as input (IODIRA) but ensures output register is set appropriately.
    await this._writeChipRegister(MCP23008_REGISTERS.OLAT, 1, initialHardwareState);
  }

  protected _readState () : Promise<number> {
    return this._readChipRegister(MCP23008_REGISTERS.GPIO, 1);
  }

  protected _writeState (state: number) : Promise<void> {
    return this._writeChipRegister(MCP23008_REGISTERS.OLAT, 1, state);
  }

  protected _writeDirection (inputPinBitmask: number) : Promise<void> {
    return this._writeChipRegister(MCP23008_REGISTERS.IODIR, 1, inputPinBitmask);
  }

  protected _writeInterruptControl(interruptBitmask: number) : Promise<void> {
    return this._writeChipRegister(MCP23008_REGISTERS.GPINTEN, 1, interruptBitmask);
  }
}