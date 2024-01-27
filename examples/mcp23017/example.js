"use strict";
/*
 * Node.js MCP23017
 *
 * Copyright (c) 2017-2023 Peter Müller <peter@crycode.de> (https://crycode.de)
 *               2024 - MCP23017 support added by Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a MCP23017 I2C port expander IC.
 *
 * This example is showing you how to setup and use inputs and outputs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Import the MCP23017 class
//import { MCP23017 } from '@lynniemagoo/i2c-io-expanders';
const __1 = require("../../");
// Import the i2c-bus module and open the bus
const i2c_bus_1 = require("i2c-bus");
const i2cBus = (0, i2c_bus_1.openSync)(1);
// Define the address of the MCP23017 (0x20)
const addr = 0x27;
const pcf = new __1.MCP23017(i2cBus, addr);
// Note the missing ; at the end of the following lines.
// This is a Promise chain!
// Init a new MCP23017 with all pins high by default
// Instead of 'true' you can also use a 8-bit binary notation to define each
// pin separately, e.g. 0b0000000000101010
pcf.initialize(true)
    // Then enable interrupt detection on BCM pin 18 (which is GPIO.0)
    .then(() => {
    // Alternatively you can use for example an interval for manually poll every 250ms
    // setInterval(pcf.doPoll.bind(pcf), 250);
    return pcf.enableInterrupt(18);
})
    // Then define pin 4 as inverted output with initally false
    .then(() => {
    return pcf.outputPin(4, true, false);
})
    // Then define pin 5 as inverted output with initally true
    .then(() => {
    return pcf.outputPin(5, true, true);
})
    // Then define pin 3 as non inverted input
    .then(() => {
    return pcf.inputPin(3, false);
})
    // Then delay 1 second
    .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
}))
    // Then turn pin 4 on
    .then(() => {
    console.log('turn pin 4 on');
    return pcf.setPin(4, true);
})
    // Then delay 1 second
    .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
}))
    // Then turn the pin 4 off
    .then(() => {
    console.log('turn pin 4 off');
    return pcf.setPin(4, false);
});
// Add an event listener on the 'input' event
pcf.on('input', (data) => {
    console.log('input', data);
    // Check if a button attached to pin 7 is pressed (signal goes low)
    if (data.pin === 3 && data.value === false) {
        // Toggle pin 5
        pcf.setPin(5);
    }
});
// Handler for clean up on SIGINT (ctrl+c)
process.on('SIGINT', async () => {
    await pcf.close();
    i2cBus.closeSync();
});
