/*
 * Node.js MCP23017
 *
 * Copyright (c) 2023-2024 Lyndel McGee <lynniemagoo@yahoo.com>
 *               2023-2024 Peter Müller <peter@crycode.de> (https://crycode.de)
 *
 * Node.js module for controlling each pin of a MCP23017 I2C port expander IC.
 */
import { I2CBus } from 'i2c-bus';

import { IOExpander } from './ioExpander';

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
 * Class for handling a MCP23017 IC.
 */
export class MCP23017 extends IOExpander<IOExpander.PinNumber16> {

  /** Number of pins the IC has. */
  protected _pins = <const>16;

  /**
   * Constructor for a new MCP23017 instance.
   * If you use this IC with one or more input pins, you have to call ...
   *  a) enableInterrupt(gpioPin) to detect interrupts from the IC using a GPIO pin, or
   *  b) doPoll() frequently enough to detect input changes with manually polling.
   * @param  {I2cBus}         i2cBus       Instance of an opened i2c-bus.
   * @param  {number}         address      The address of the MCP23017 IC.
   */
  constructor (i2cBus: I2CBus, address: number) {
    super(i2cBus, address);
  }

  protected async _initializeChip () : Promise<void> {
    // On startup, Default chip config to use Bank 0 with Interrupt Mirroring and Open-Drain (Active Low) interrupts
    const ioconFlags =
      MCP23017_IOCON_FLAGS.DEFAULT |
      MCP23017_IOCON_FLAGS.INT_MIRROR_ON |
      MCP23017_IOCON_FLAGS.INT_OPEN_DRAIN_ENABLED;

    await this._writeChipRegister(MCP23017_REGISTERS.IOCONA, 1, ioconFlags);
    // Disable all interrupts.
    await this._writeChipRegister(MCP23017_REGISTERS.GPINTENA, 2, 0x00);
    // Set pins marked as input.
    await this._writeChipRegister(MCP23017_REGISTERS.IODIRA, 2, this._inputPinBitmask);
    // Force all pins to Pull-Up.
    await this._writeChipRegister(MCP23017_REGISTERS.GPPUA, 2, 0xFFFF);
    // Force no Polarity Invert as we will manage this in software with the _inverted bitField.
    await this._writeChipRegister(MCP23017_REGISTERS.IPOLA, 2, 0x00);
    // Set interrupt change default values to 0.
    await this._writeChipRegister(MCP23017_REGISTERS.INTCONA, 2, 0x00);
    // Write the initial state which should have no effect as all ports set as input but ensures output register is set appropriately.
    await this._writeChipRegister(MCP23017_REGISTERS.OLATA, 2, this._currentState);
  }

  protected _readState () : Promise<number> {
    return this._readChipRegister(MCP23017_REGISTERS.GPIOA, 2);
  }

  protected _writeState (state: number) : Promise<void> {
    return this._writeChipRegister(MCP23017_REGISTERS.OLATA, 2, state);
  }

  protected _writeDirection (inputPinBitmask: number) : Promise<void> {
    return this._writeChipRegister(MCP23017_REGISTERS.IODIRA, 2, inputPinBitmask);
  }

  protected _writeInterruptControl(interruptBitmask: number) : Promise<void> {
    return this._writeChipRegister(MCP23017_REGISTERS.GPINTENA, 2, interruptBitmask);
  }
}