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

// Define the address of the CAT9555 (0x20)
const addr: number = 0x27;

// Init a new CAT9555 with all pins high by default
// Instead of 'true' you can also use a 16-bit binary notation to define each
// pin speratly, e.g. 0b0000000000101010
const cat: CAT9555 = new CAT9555(i2cBus, addr, true);

// Enable interrupt detection on BCM pin 18 (which is GPIO.0)
cat.enableInterrupt(18);

// Alternatively you can use for example an interval for manually poll every 250ms
// setInterval(cat.doPoll.bind(cat), 250);

// Note the missing ; at the end of the following lines.
// This is a Promise chain!

cat.outputPin(7, true, false)
  .then(() => {
    return cat.outputPin(6, true, false);
  })
  .then(() => {
    return cat.outputPin(5, true, false);
  })
  .then(() => {
    return cat.outputPin(4, true, false);
  })
  // Then define pins 0-3 as inverted input
  .then(() => {
    return cat.inputPin(0, true);
  })
  .then(() => {
    return cat.inputPin(1, true);
  })
  .then(() => {
    return cat.inputPin(2, true);
  })
  .then(() => {
    return cat.inputPin(3, true);
  })
  .then(() => {
    return cat.setPin(5);
  })
  // Delay 1 second
  .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
  }))
  .then(() => {
    return cat.setPin(5);
  })
  // Delay 1 second
  .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
  }))
  .then(() => {
    return cat.setPin(6);
  })
  // Delay 1 second
  .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
  }))
  // Then turn the pin on
  .then(() => {
    return cat.setPin(6);
  })
  // Delay 1 second
  .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
  }))

// Add an event listener on the 'input' event
cat.on('input', (data: CAT9555.InputData) => {
  console.log('input', data);
  switch(data.pin) {
    case 3:
      cat.setPin(7, data.value);
      break;
    case 2:
      cat.setPin(6, data.value);
      break;
    case 1:
      cat.setPin(5, data.value);
      break;
    case 0:
    default:
      cat.setPin(4, data.value);
      break;
  }
});

// Handler for clean up on SIGINT (ctrl+c)
process.on('SIGINT', () => {
  cat.removeAllListeners();
  cat.disableInterrupt();
});
