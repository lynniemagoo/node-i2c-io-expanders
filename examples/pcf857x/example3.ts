/*
 * Node.js PCF8574/PCF8574A
 *
 * Copyright (c) 2017-2023 Peter Müller <peter@crycode.de> (https://crycode.de)
 *               2022 - PCF8575 support inspired by Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a PCF8574/PCF8574A I2C port expander IC.
 *
 * This example is showing you how to setup and use inputs and outputs.
 */

// Import the PCF8574 class from the pcf8574 module
//import { PCF8574 } from 'pcf8574';
import { PCF8574 } from '../../';

// Import the i2c-bus module and open the bus
import {I2CBus, openSync as I2CBusOpenSync} from 'i2c-bus';
const i2cBus: I2CBus = I2CBusOpenSync(1);

// Define the address of the PCF8574 (0x20) /PCF8574A (0x38)
const addr: number = 0x20;

// Init a new PCF8574 with all pins high by default
// Instead of 'true' you can also use a 8-bit binary notation to define each
// pin separately, e.g. 0b00101010
const pcf: PCF8574 = new PCF8574(i2cBus, addr, true);

// Enable interrupt detection on BCM pin 17 (which is GPIO.0)
pcf.enableInterrupt(17);

// Alternatively you can use for example an interval for manually poll every 250ms
// setInterval(pcf.doPoll.bind(pcf), 250);

// Note the missing ; at the end of the following lines.
// This is a Promise chain!

pcf.outputPin(0, true, false)
  .then(() => {
    return pcf.outputPin(1, true, false);
  })
  .then(() => {
    return pcf.outputPin(2, true, false);
  })
  .then(() => {
    return pcf.outputPin(3, true, false);
  })
  // Then define pin 7 as non inverted input
  .then(() => {
    return pcf.inputPin(7, true);
  })
  .then(() => {
    return pcf.inputPin(6, true);
  })
  .then(() => {
    return pcf.inputPin(5, true);
  })
  .then(() => {
    return pcf.inputPin(4, true);
  })
  .then(() => {
    return pcf.setPin(1);
  })
  // Delay 1 second
  .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
  }))
  .then(() => {
    return pcf.setPin(1);
  })
  // Delay 1 second
  .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
  }))
  .then(() => {
    return pcf.setPin(2);
  })
  // Delay 1 second
  .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
  }))
  // Then turn the pin on
  .then(() => {
    pcf.setPin(2);
  })
  // Delay 1 second
  .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
  }))
// Add an event listener on the 'input' event
pcf.on('input', (data: PCF8574.InputData) => {
  console.log('input', data);
  switch(data.pin) {
    case 7:
      pcf.setPin(3, data.value);
      break;
    case 6:
      pcf.setPin(2, data.value);
      break;
    case 5:
      pcf.setPin(1, data.value);
      break;
    case 4:
    default:
      pcf.setPin(0, data.value);
      break;
  }
});

// Handler for clean up on SIGINT (ctrl+c)
process.on('SIGINT', () => {
  pcf.removeAllListeners();
  pcf.disableInterrupt();
});
