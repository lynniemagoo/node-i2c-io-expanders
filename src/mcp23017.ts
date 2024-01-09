/*
 * Node.js MCP23017
 *
 * Copyright (c) 2023 Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a MCP23017 I2C port expander IC.
 */
import { I2CBus } from 'i2c-bus';

import { IOExpander } from './shared/ioExpander';

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

  /**
   * Constructor for a new MCP23017 instance.
   * If you use this IC with one or more input pins, you have to call ...
   *  a) enableInterrupt(gpioPin) to detect interrupts from the IC using a GPIO pin, or
   *  b) doPoll() frequently enough to detect input changes with manually polling.
   * @param  {I2cBus}         i2cBus       Instance of an opened i2c-bus.
   * @param  {number}         address      The address of the MCP23017 IC.
   * @param  {boolean|number} initialState The initial state of the pins of this IC. You can set a bitmask to define each pin seprately, or use true/false for all pins at once.
   */
  constructor (i2cBus: I2CBus, address: number, initialState: boolean | number) {
    super(i2cBus, address, initialState, 16);
  }

  _initializeChipSync (initialState: number, inputPinBitmask: number) : void {

    // On startup, Default chip config to use Bank 0 with Interrupt Mirroring and Open-Drain (Active Low) interrupts
    const ioconFlags =
      MCP23017_IOCON_FLAGS.DEFAULT |
      MCP23017_IOCON_FLAGS.INT_MIRROR_ON |
      MCP23017_IOCON_FLAGS.INT_OPEN_DRAIN_ENABLED,
      buffAllOn: Buffer = Buffer.from([0xFF, 0xFF]),
      buffAllOff: Buffer = Buffer.from([0x00, 0x00]);

    this._i2cBus.writeByteSync(this._address, MCP23017_REGISTERS.IOCONA, ioconFlags);

    // Disable all interrupts.
    this._i2cBus.writeI2cBlockSync(this._address, MCP23017_REGISTERS.GPINTENA, 2, buffAllOff);

    // Set pins marked as input.
    this._i2cBus.writeI2cBlockSync(this._address, MCP23017_REGISTERS.IODIRA, 2, Buffer.from([inputPinBitmask & 0xFF, (inputPinBitmask >> 8) & 0xFF]));

    // Force all pins to Pull-Up.
    this._i2cBus.writeI2cBlockSync(this._address, MCP23017_REGISTERS.GPPUA, 2, buffAllOn);

    // Force no Polarity Invert as we will manage this in software with the _inverted bitField.
    this._i2cBus.writeI2cBlockSync(this._address, MCP23017_REGISTERS.IPOLA, 2, buffAllOff);

    // Set interrupt change default values to 0.
    this._i2cBus.writeI2cBlockSync(this._address, MCP23017_REGISTERS.DEFVALA, 2, buffAllOff);

    // Force interrupts to fire on state change - don't compare to DEFVAL.
    this._i2cBus.writeI2cBlockSync(this._address, MCP23017_REGISTERS.INTCONA, 2, buffAllOff);

    // Write the initial state which should have no effect as all ports set as input but ensures output register is set appropriately.
    this._i2cBus.writeI2cBlockSync(this._address, MCP23017_REGISTERS.OLATA, 2, Buffer.from([initialState & 0xFF, (initialState >> 8) & 0xFF]));
  }

  _writeInterruptControlSync (interruptBitmask: number) : void {
    this._i2cBus.writeI2cBlockSync(this._address, MCP23017_REGISTERS.GPINTENA, 2, Buffer.from([interruptBitmask & 0xFF, (interruptBitmask >> 8) & 0xFF]));
  }

  _readState () : Promise<number> {
    return new Promise((resolve: (chipState: number) => void, reject: (err: Error) => void) => {
      this._i2cBus.readI2cBlock(this._address, MCP23017_REGISTERS.GPIOA, 2, Buffer.alloc(2), (err, bytesRead, buffer) => {
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
      this._i2cBus.writeI2cBlock(this._address, MCP23017_REGISTERS.OLATA, 2, Buffer.from([state & 0xFF, (state >> 8) & 0xFF]), (err, bytesWritten) => {
        if (err || (bytesWritten != 2)) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  _writeDirection (inputPinBitmask: number) : Promise<void> {
    return new Promise((resolve: () => void, reject: (err: Error) => void) => {
      this._i2cBus.writeI2cBlock(this._address, MCP23017_REGISTERS.IODIRA, 2, Buffer.from([inputPinBitmask & 0xFF, (inputPinBitmask >> 8) & 0xFF]), (err, bytesWritten) => {
        if (err || (bytesWritten != 2)) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  _writeInterruptControl(interruptBitmask: number) : Promise<void> {
    return new Promise((resolve: () => void, reject: (err: Error) => void) => {
      this._i2cBus.writeI2cBlock(this._address, MCP23017_REGISTERS.GPINTENA, 2, Buffer.from([interruptBitmask & 0xFF, (interruptBitmask >> 8) & 0xFF]), (err, bytesWritten) => {
        if (err || (bytesWritten != 2)) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}