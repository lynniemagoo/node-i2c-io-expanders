"use strict";
/*
 * Node.js PCF8575
 *
 * Copyright (c) 2017-2024 Peter Müller <peter@crycode.de> (https://crycode.de)
 *               2022 - PCF8575 support inspired by Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a PCF8575 I2C port expander IC.
 *
 * This example is showing you how to setup and use inputs and outputs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Import the PCF8575 class
//import { PCF8575 } from 'i2c-io-expanders';
const __1 = require("../../");
// Import the i2c-bus module and open the bus
const i2c_bus_1 = require("i2c-bus");
const i2cBus = (0, i2c_bus_1.openSync)(1);
// Define a sleep Helper
const sleepMs = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
// Define the address of the PCF8575 (0x20)
const addr = 0x20;
// Create an instance of the chip.
const chip = new __1.PCF8575(i2cBus, addr);
const example = async () => {
    // Handler for clean up on SIGINT (ctrl+c)
    process.on('SIGINT', async () => {
        await chip.close();
        i2cBus.closeSync();
    });
    // Init a new PCF8575 with all pins high by default
    // Instead of 'true' you can also use a 8-bit binary notation to define each
    // pin separately, e.g. 0b0000000000101010
    await chip.initialize(true);
    // Then define pin 0 as inverted output with initally false
    await chip.outputPin(0, true, false);
    // Then define pin 1 as inverted output with initally true
    await chip.outputPin(1, true, true);
    // Then define pin 7 as non inverted input
    await chip.inputPin(7, false);
    // Then delay 1 second
    await sleepMs(1000);
    // Then turn pin 0 on
    console.log('turn pin 0 on');
    await chip.setPin(0, true);
    // Then delay 1 second
    await sleepMs(1000);
    // Then turn pin 0 off
    console.log('turn pin 0 off');
    await chip.setPin(0, false);
    // Add an event listener on the 'input' event
    chip.on('input', (data) => {
        console.log('input', data);
        // Check if a button attached to pin 7 is pressed (signal goes low)
        if (data.pin === 7 && data.value === false) {
            // setPin returns a promise which we do not wait for.
            // Toggle pin 1
            chip.setPin(1);
        }
    });
    // Then enable interrupt detection on BCM pin 17 (which is GPIO.0)
    // Alternatively you can use for example an interval for manually poll every 250ms
    // setInterval(chip.doPoll.bind(chip), 250);
    await chip.enableInterrupt(17);
};
// Run the example
example();
