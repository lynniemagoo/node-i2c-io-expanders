"use strict";
/*
 * Node.js MCP23017.js
 *
 * Copyright (c) 2023 Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a MCP23017 I2C port expander IC.
 *
 * This example is showing you how to setup and use inputs and outputs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Import the MCP23017 class from the MCP23017 module
//import { MCP23017 } from 'MCP23017';
var __1 = require("../../");
// Import the i2c-bus module and open the bus
var i2c_bus_1 = require("i2c-bus");
var i2cBus = (0, i2c_bus_1.openSync)(1);
// Define the address of the MCP23017
var addr = 0x27;
// Init a new MCP23017 with all pins high by default
// Instead of 'true' you can also use a 16-bit binary notation to define each
// pin speratly, e.g. 0b0000000000101010
var mcp = new __1.MCP23017(i2cBus, addr, true);
// Enable interrupt detection on BCM pin 18 (which is GPIO.1)
mcp.enableInterrupt(18);
// Alternatively you can use for example an interval for manually poll every 250ms
// setInterval(mcp.doPoll.bind(mcp), 250);
// Note the missing ; at the end of the following lines.
// This is a Promise chain!
// Define pin 15 as inverted output with initally false
mcp.outputPin(15, true, false)
    // Then define pin 14 as inverted output with initally false
    .then(function () {
    return mcp.outputPin(14, true, false);
})
    // Then define pin 0 as non inverted input
    .then(function () {
    return mcp.inputPin(0, true);
})
    // Delay 1 second
    .then(function () { return new Promise(function (resolve) {
    setTimeout(resolve, 1000);
}); })
    // Then turn the pin on
    .then(function () {
    console.log('turn pin 15 on');
    return mcp.setPin(15, true);
})
    // Delay 1 second
    .then(function () { return new Promise(function (resolve) {
    setTimeout(resolve, 1000);
}); })
    // Then turn the pin off
    .then(function () {
    console.log('turn pin 15 off');
    return mcp.setPin(15, false);
});
// Add an event listener on the 'input' event
mcp.on('input', function (data) {
    console.log('input', data);
    // Check if a button attached to pin 0 is pressed (signal goes low)
    if (data.pin === 0 && data.value === false) {
        // Toggle pin 14
        mcp.setPin(14);
    }
});
// Handler for clean up on SIGINT (ctrl+c)
process.on('SIGINT', function () {
    mcp.removeAllListeners();
    mcp.disableInterrupt();
});
