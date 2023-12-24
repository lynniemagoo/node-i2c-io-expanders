/*
 * Node.js MCP23017.js
 *
 * Copyright (c) 2023 Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a MCP23017 I2C port expander IC.
 *
 * This example is showing you how to setup and use inputs and outputs.
 */

// Import the MCP23017 class from the MCP23017 module
//import { MCP23017 } from 'MCP23017';
import { MCP23017 } from '../../';

// Import the i2c-bus module and open the bus
import {I2CBus, openSync as I2CBusOpenSync} from 'i2c-bus';
const i2cBus: I2CBus = I2CBusOpenSync(1);

// Define the address of the MCP23017
const addr: number = 0x27;

// Init a new MCP23017 with all pins high by default
// Instead of 'true' you can also use a 16-bit binary notation to define each
// pin speratly, e.g. 0b0000000000101010
const mcp: MCP23017 = new MCP23017(i2cBus, addr, true);

// Enable interrupt detection on BCM pin 18 (which is GPIO.1)
mcp.enableInterrupt(18);

// Alternatively you can use for example an interval for manually poll every 250ms
// setInterval(mcp.doPoll.bind(mcp), 250);

// Note the missing ; at the end of the following lines.
// This is a Promise chain!

// Define pin 15 as inverted output with initally false
mcp.outputPin(15, true, false)

// Then define pin 14 as inverted output with initally false
  .then(() => {
    return mcp.outputPin(14, true, false);
  })

  // Then define pin 0 as non inverted input
  .then(() => {
    return mcp.inputPin(0, true);
  })

  // Delay 1 second
  .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
  }))

  // Then turn the pin on
  .then(() => {
    console.log('turn pin 15 on');
    return mcp.setPin(15, true);
  })

  // Delay 1 second
  .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
  }))

  // Then turn the pin off
  .then(() => {
    console.log('turn pin 15 off');
    return mcp.setPin(15, false);
  });

// Add an event listener on the 'input' event
mcp.on('input', (data: MCP23017.InputData) => {
  console.log('input', data);

  // Check if a button attached to pin 0 is pressed (signal goes low)
  if(data.pin === 0 && data.value === false){
    // Toggle pin 14
    mcp.setPin(14);
  }
});

// Handler for clean up on SIGINT (ctrl+c)
process.on('SIGINT', () => {
  mcp.removeAllListeners();
  mcp.disableInterrupt();
});
