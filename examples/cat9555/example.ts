/*
 * Node.js CAT9555
 *
 * Copyright (c) 2017-2023 Peter Müller <peter@crycode.de> (https://crycode.de)
 *               2022 - CAT9555 support added by Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a CAT9555 I2C port expander IC.
 *
 * This example is showing you how to setup and use inputs and outputs.
 */

// Import the CAT9555 class
//import { CAT9555 } from '@lynniemagoo/i2c-io-expanders';
import { CAT9555 } from '../../';

// Import the i2c-bus module and open the bus
import {I2CBus, openSync as I2CBusOpenSync} from 'i2c-bus';
const i2cBus: I2CBus = I2CBusOpenSync(1);

// Define the address of the CAT9555 (0x20)
const addr: number = 0x27;

const pcf: CAT9555 = new CAT9555(i2cBus, addr);


// Note the missing ; at the end of the following lines.
// This is a Promise chain!

// Init a new CAT9555 with all pins high by default
// Instead of 'true' you can also use a 8-bit binary notation to define each
// pin separately, e.g. 0b0000000000101010
pcf.initialize(true)

  // Then enable interrupt detection on BCM pin 18 (which is GPIO.0)
  .then(() => {
    // Alternatively you can use for example an interval for manually poll every 250ms
    // setInterval(pcf.doPoll.bind(pcf), 250);
    return pcf.enableInterrupt(18);
  })

  // Then define pin 0 as inverted output with initally false
  .then(() => {
    return pcf.outputPin(0, true, false);
  })

  // Then define pin 1 as inverted output with initally true
  .then(() => {
    return pcf.outputPin(1, true, true);
  })

  // Then define pin 7 as non inverted input
  .then(() => {
    return pcf.inputPin(7, false);
  })

  // Then delay 1 second
  .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
  }))

  // Then turn pin 0 on
  .then(() => {
    console.log('turn pin 0 on');
    return pcf.setPin(0, true);
  })

  // Then delay 1 second
  .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
  }))

  // Then turn the pin 0 off
  .then(() => {
    console.log('turn pin 0 off');
    return pcf.setPin(0, false);
  });

// Add an event listener on the 'input' event
pcf.on('input', (data: CAT9555.InputData) => {
  console.log('input', data);

  // Check if a button attached to pin 7 is pressed (signal goes low)
  if(data.pin === 7 && data.value === false){
    // Toggle pin 1
    pcf.setPin(1);
  }
});

// Handler for clean up on SIGINT (ctrl+c)
process.on('SIGINT', async () => {
  await pcf.close();
  i2cBus.closeSync();
});
