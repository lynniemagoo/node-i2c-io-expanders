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
// Import the PCF8574 class
//import { PCF8574 } from '@lynniemagoo/i2c-io-expanders';
const __1 = require("../../");
// Import the i2c-bus module and open the bus
const i2c_bus_1 = require("i2c-bus");
const i2cBus = (0, i2c_bus_1.openSync)(1);
// Define the address of the PCF8574 (0x20) /PCF8574A (0x38)
const addr = 0x20;
const pcf = new __1.PCF8574(i2cBus, addr);
// Note the missing ; at the end of the following lines.
// This is a Promise chain!
// Init a new PCF8574 with all pins high by default
// Instead of 'true' you can also use a 8-bit binary notation to define each
// pin separately, e.g. 0b00101010
pcf.initialize(true)
    // Then enable interrupt detection on BCM pin 17 (which is GPIO.0)
    .then(() => {
    // Alternatively you can use for example an interval for manually poll every 250ms
    // setInterval(pcf.doPoll.bind(pcf), 250);
    return pcf.enableInterrupt(17);
})
    // Then define pins 0-3 as inverted output initially false (off)
    .then(() => {
    return pcf.outputPin(0, true, false);
})
    .then(() => {
    return pcf.outputPin(1, true, false);
})
    .then(() => {
    return pcf.outputPin(2, true, false);
})
    .then(() => {
    return pcf.outputPin(3, true, false);
})
    // Then define pins 4-7 as inverted inputs
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
    // Then toggle pin 1 (on)
    .then(() => {
    return pcf.setPin(1);
})
    // The delay 1 second
    .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
}))
    // Then toggle pin 1 (off)
    .then(() => {
    return pcf.setPin(1);
})
    // Then delay 1 second
    .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
}))
    // Then toggle pin 2 (on)
    .then(() => {
    return pcf.setPin(2);
})
    // Then delay 1 second
    .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
}))
    // Then toggle pin 2 (off)
    .then(() => {
    pcf.setPin(2);
})
    // Delay 1 second
    .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
}));
// Add an event listener on the 'input' event
pcf.on('input', (data) => {
    console.log('input', data);
    switch (data.pin) {
        case 7:
            // setPinReturns a promise which we do not wait for.
            pcf.setPin(3, data.value);
            break;
        case 6:
            // setPinReturns a promise which we do not wait for.
            pcf.setPin(2, data.value);
            break;
        case 5:
            // setPinReturns a promise which we do not wait for.
            pcf.setPin(1, data.value);
            break;
        case 4:
        default:
            // setPinReturns a promise which we do not wait for.
            pcf.setPin(0, data.value);
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
