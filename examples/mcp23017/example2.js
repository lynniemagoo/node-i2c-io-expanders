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
    // Then define pins 4-7 as inverted output initially false (off)
    .then(() => {
    return pcf.outputPin(4, true, false);
})
    .then(() => {
    return pcf.outputPin(5, true, false);
})
    .then(() => {
    return pcf.outputPin(6, true, false);
})
    .then(() => {
    return pcf.outputPin(7, true, false);
})
    // Then define pins 0-3 as inverted inputs
    .then(() => {
    return pcf.inputPin(3, true);
})
    .then(() => {
    return pcf.inputPin(2, true);
})
    .then(() => {
    return pcf.inputPin(1, true);
})
    .then(() => {
    return pcf.inputPin(0, true);
})
    // Then toggle pin 5 (on)
    .then(() => {
    return pcf.setPin(5);
})
    // Then delay 1 second
    .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
}))
    // Then toggle pin 5 (off)
    .then(() => {
    return pcf.setPin(5);
})
    // Then delay 1 second
    .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
}))
    // Then toggle pin 6 (on)
    .then(() => {
    return pcf.setPin(6);
})
    // Then delay 1 second
    .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
}))
    // Then toggle pin 6 (off)
    .then(() => {
    pcf.setPin(6);
})
    // Then delay 1 second
    .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
}));
// Add an event listener on the 'input' event
pcf.on('input', (data) => {
    console.log('input', data);
    switch (data.pin) {
        case 3:
            // setPinReturns a promise which we do not wait for.
            pcf.setPin(7, data.value);
            break;
        case 2:
            // setPinReturns a promise which we do not wait for.
            pcf.setPin(6, data.value);
            break;
        case 1:
            // setPinReturns a promise which we do not wait for.
            pcf.setPin(5, data.value);
            break;
        case 0:
        default:
            // setPinReturns a promise which we do not wait for.
            pcf.setPin(4, data.value);
            break;
    }
});
// It is possible if during 'input' event handling that you could miss an interrupt
// if you block the event loop.  So, the 'interrupt' event is provided to signal the lastChild
// interrupt that occurred.  After some time you can request a poll of the chip so that
// the latest input pin states are read and any missed interrupt will be cleared.
let _postInterruptTimeout = null;
const POST_INTERRUPT_DELAY_TIME_MS = 10000;
function clearPostInterruptTimeout() {
    if (_postInterruptTimeout) {
        clearTimeout(_postInterruptTimeout);
        _postInterruptTimeout = null;
    }
}
function createPostInterruptTimeout(delayTimeMs) {
    clearPostInterruptTimeout();
    _postInterruptTimeout = setTimeout(() => {
        console.log('Last interrupt occurred %oms ago.  Will now poll chip', delayTimeMs);
        // doPoll() returns a promise that we are not waiting on here.
        pcf.doPoll();
    }, delayTimeMs);
}
pcf.on('interrupt', function (_processed) {
    createPostInterruptTimeout(POST_INTERRUPT_DELAY_TIME_MS);
});
// Handler for clean up on SIGINT (ctrl+c)
process.on('SIGINT', async () => {
    clearPostInterruptTimeout();
    await pcf.close();
    i2cBus.closeSync();
});
