/*
 * Node.js MCP23008
 *
 * Copyright (c) 2017-2024 Peter Müller <peter@crycode.de> (https://crycode.de)
 *               2024 - MCP23008 support developed by Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a MCP23008 I2C port expander IC.
 *
 * This example is showing you how to setup and use inputs and outputs.
 */

// Require the MCP23008 class from the i2c-io-expanders module
//const MCP23008 = require('i2c-io-expanders').MCP23008;
const MCP23008 = require('../../').MCP23008;

// Require the i2c-bus module and open the bus
const i2cBus = require('i2c-bus').openSync(1);

// Define a sleep Helper
const sleepMs = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Define the address of the MCP23008 (0x20)
const addr = 0x27;

// Create an instance of the chip.
const chip = new MCP23008(i2cBus, addr);

const example = async () => {

  // Handler for clean up on SIGINT (ctrl+c)
  process.on('SIGINT', async () => {
    await chip.close();
    i2cBus.closeSync();
  });

  // Init a new MCP23008 with all pins high by default
  // Instead of 'true' you can also use a 8-bit binary notation to define each
  // pin separately, e.g. 0b00101010
  await chip.initialize(true);
  
  // Then define pin 4 as inverted output with initally false
  await chip.outputPin(4, true, false);

  // Then define pin 5 as inverted output with initally true
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
  chip.on('input', (data) => {
    console.log('input', data);
    // Check if a button attached to pin 3 is pressed (signal goes low)
    if (data.pin === 3 && data.value === false) {
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