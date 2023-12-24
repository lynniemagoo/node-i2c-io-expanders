/*
 * Node.js CAT9555.js
 *
 * Copyright (c) 2023 Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a CAT9555 I2C port expander IC.
 *
 * This example is showing you how to setup and use inputs and outputs.
 */

// Import the CAT9555 class from the CAT9555 module
//import { CAT9555 } from 'CAT9555';
import { CAT9555 } from '../../';

// Import the i2c-bus module and open the bus
import {I2CBus, openSync as I2CBusOpenSync} from 'i2c-bus';
const i2cBus: I2CBus = I2CBusOpenSync(1);

// Define the address of the CAT9555
const addr: number = 0x27;

// Init a new CAT9555 with all pins high by default
// Instead of 'true' you can also use a 16-bit binary notation to define each
// pin speratly, e.g. 0b0000000000101010
const cat: CAT9555 = new CAT9555(i2cBus, addr, true);

// Enable interrupt detection on BCM pin 17 (which is GPIO.0)
cat.enableInterrupt(17);

// Alternatively you can use for example an interval for manually poll every 250ms
// setInterval(cat.doPoll.bind(cat), 250);

// Note the missing ; at the end of the following lines.
// This is a Promise chain!

// Define pin 0 as inverted output with initally false
cat.outputPin(0, true, false)

// Then define pin 1 as inverted output with initally true
  .then(() => {
    return cat.outputPin(1, true, true);
  })

  // Then define pin 15 as non inverted input
  .then(() => {
    return cat.inputPin(15, false);
  })

  // Delay 1 second
  .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
  }))

  // Then turn the pin on
  .then(() => {
    console.log('turn pin 0 on');
    return cat.setPin(0, true);
  })

  // Delay 1 second
  .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
  }))

  // Then turn the pin off
  .then(() => {
    console.log('turn pin 0 off');
    return cat.setPin(0, false);
  });

// Add an event listener on the 'input' event
cat.on('input', (data: CAT9555.InputData) => {
  console.log('input', data);

  // Check if a button attached to pin 15 is pressed (signal goes low)
  if(data.pin === 15 && data.value === false){
    // Toggle pin 1
    cat.setPin(1);
  }
});

// Handler for clean up on SIGINT (ctrl+c)
process.on('SIGINT', () => {
  cat.removeAllListeners();
  cat.disableInterrupt();
});
