"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
// Import the PCF8574 class from the pcf8574 module
//import { PCF8574 } from 'pcf8574';
var __1 = require("../../");
// Import the i2c-bus module and open the bus
var i2c_bus_1 = require("i2c-bus");
var i2cBus = (0, i2c_bus_1.openSync)(1);
// Define the address of the PCF8574 (0x20) /PCF8574A (0x38)
var addr = 0x20;
// Init a new PCF8574 with all pins high by default
// Instead of 'true' you can also use a 8-bit binary notation to define each
// pin separately, e.g. 0b00101010
var pcf = new __1.PCF8574(i2cBus, addr, true);
// Enable interrupt detection on BCM pin 17 (which is GPIO.0)
pcf.enableInterrupt(17);
// Alternatively you can use for example an interval for manually poll every 250ms
// setInterval(pcf.doPoll.bind(pcf), 250);
// Note the missing ; at the end of the following lines.
// This is a Promise chain!
pcf.outputPin(0, true, false)
    .then(function () {
    return pcf.outputPin(1, true, false);
})
    .then(function () {
    return pcf.outputPin(2, true, false);
})
    .then(function () {
    return pcf.outputPin(3, true, false);
})
    // Then define pin 7 as non inverted input
    .then(function () {
    return pcf.inputPin(7, true);
})
    .then(function () {
    return pcf.inputPin(6, true);
})
    .then(function () {
    return pcf.inputPin(5, true);
})
    .then(function () {
    return pcf.inputPin(4, true);
})
    .then(function () {
    return pcf.setPin(1);
})
    // Delay 1 second
    .then(function () { return new Promise(function (resolve) {
    setTimeout(resolve, 1000);
}); })
    .then(function () {
    return pcf.setPin(1);
})
    // Delay 1 second
    .then(function () { return new Promise(function (resolve) {
    setTimeout(resolve, 1000);
}); })
    .then(function () {
    return pcf.setPin(2);
})
    // Delay 1 second
    .then(function () { return new Promise(function (resolve) {
    setTimeout(resolve, 1000);
}); })
    // Then turn the pin on
    .then(function () {
    pcf.setPin(2);
})
    // Delay 1 second
    .then(function () { return new Promise(function (resolve) {
    setTimeout(resolve, 1000);
}); });
// Add an event listener on the 'input' event
pcf.on('input', function (data) {
    console.log('input', data);
    switch (data.pin) {
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
var _postInterruptTimeout = null;
var POST_INTERRUPT_DELAY_TIME_MS = 1500;
function clearPostInterruptTimeout() {
    if (_postInterruptTimeout) {
        clearTimeout(_postInterruptTimeout);
        _postInterruptTimeout = null;
    }
}
function createPostInterruptTimeout(delayTimeMs) {
    clearPostInterruptTimeout();
    _postInterruptTimeout = setTimeout(function () {
        console.log('postInterruptTimeout(): will now poll chip after waiting %oms', delayTimeMs);
        pcf.doPoll();
    }, delayTimeMs);
}
pcf.on('interrupt', function (processed) {
    //console.log('interrupt processed:%o', processed);
    createPostInterruptTimeout(POST_INTERRUPT_DELAY_TIME_MS);
});
// Handler for clean up on SIGINT (ctrl+c)
process.on('SIGINT', function () {
    clearPostInterruptTimeout();
    pcf.removeAllListeners();
    pcf.disableInterrupt();
    i2cBus.closeSync();
});
