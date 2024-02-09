/*
 * Node.js MCP23017
 *
 * Copyright (c) 2017-2024 Peter Müller <peter@crycode.de> (https://crycode.de)
 *               2024 - MCP23017 support developed by Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a MCP23017 I2C port expander IC.
 *
 * This example is showing you how to setup and use inputs and outputs.
 */

// Import the MCP23017 class
//import { MCP23017 } from 'i2c-io-expanders';
import { MCP23017 } from '../../';

// Import the i2c-bus module and open the bus
import {I2CBus, openSync as I2CBusOpenSync} from 'i2c-bus';
const i2cBus: I2CBus = I2CBusOpenSync(1);

// Define a sleep Helper
const sleepMs = (ms: number) : Promise<void> => new Promise((resolve) => {setTimeout(resolve, ms);})

// Define the address of the MCP23017 (0x20)
const addr: number = 0x27;

//============================================================================================================================
// The MCP23017 implementation provided here groups the physical Ports A and B of the MCP23017 chip into a single set of pins
// PortA pins 0-7 => Pins 0-7
// PortB pins 0-7 => Pins 8-15
//
// To support this configuration, interrupts are also configured as 'mirrored'.  Therefore, your application can choose to connect
// either of the interrupt pins of the chip to a single GPIO of your CPU.
//
// Future implementations of this package may provide the capability to configure individual instances to address either PortA
// or PortB. i.e. MCP23017A or MCP23107B
//============================================================================================================================

// Create an instance of the chip.
const chip: MCP23017 = new MCP23017(i2cBus, addr);

const example = async () : Promise<void> => {

  // Handler for clean up on SIGINT (ctrl+c)
  process.on('SIGINT', async () => {
    await chip.close();
    i2cBus.closeSync();
  });

  // Init a new MCP23017 with all pins high by default
  // Instead of 'true' you can also use a 16-bit binary notation to define each
  // pin separately, e.g. 0b0000000000101010
  await chip.initialize(true);

  // Then define pin 4 (A4) as inverted output with initally false
  await chip.outputPin(4, true, false);

  // Then define pin 5 (A5) as inverted output with initally true
  await chip.outputPin(5, true, true);

  // Then define pin 3 as non inverted input
  await chip.inputPin(3, false);

  // Then delay 1 second
  await sleepMs(1000);

  // Then turn pin 4 on
  console.log('turn pin 4 on');
  await chip.setPin(4, true);

  // Then delay 1 second
  await sleepMs(1000);

  // Then turn pin 4 off
  console.log('turn pin 4 off');
  await chip.setPin(4, false);

  // Add an event listener on the 'input' event
  chip.on('input', (data: MCP23017.InputData) => {
    console.log('input', data);

    // Check if a button attached to pin 4 is pressed (signal goes low)
    if(data.pin === 3 && data.value === false) {
      // setPin returns a promise which we do not wait for.
      // Toggle pin 5
      chip.setPin(5);
    }
  });

  // Then enable interrupt detection on BCM pin 18 (which is GPIO.1)
  // Alternatively you can use for example an interval for manually poll every 250ms
  // setInterval(chip.doPoll.bind(chip), 250);
  await chip.enableInterrupt(18);
};

// Run the example
example();