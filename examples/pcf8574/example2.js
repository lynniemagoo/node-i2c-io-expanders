"use strict";
/*
 * Node.js PCF8574/PCF8574A
 *
 * Copyright (c) 2017-2024 Peter Müller <peter@crycode.de> (https://crycode.de)
 *               2022 - PCF8575 support inspired by Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a PCF8574/PCF8574A I2C port expander IC.
 *
 * This example is showing you how to setup and use inputs and outputs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Import the PCF8574 class
//import { PCF8574 } from 'i2c-io-expanders';
const __1 = require("../../");
// Import the i2c-bus module and open the bus
const i2c_bus_1 = require("i2c-bus");
const i2cBus = (0, i2c_bus_1.openSync)(1);
// Define a sleep Helper
const sleepMs = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
// Define the address of the PCF8574 (0x20) /PCF8574A (0x38)
const addr = 0x20;
// Create an instance of the chip.
const chip = new __1.PCF8574(i2cBus, addr);
// See notes below regarding the 'interrupt' event.
let _postInterruptTimeout = null;
const POST_INTERRUPT_DELAY_TIME_MS = 1000;
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
        chip.doPoll();
    }, delayTimeMs);
}
const example = async () => {
    // Handler for clean up on SIGINT (ctrl+c)
    process.on('SIGINT', async () => {
        clearPostInterruptTimeout();
        await chip.close();
        i2cBus.closeSync();
    });
    // Init a new PCF8574 with all pins high by default
    // Instead of 'true' you can also use a 8-bit binary notation to define each
    // pin separately, e.g. 0b00101010
    await chip.initialize(true);
    // Then define pins 0-3 as inverted output initially false (off)
    await chip.outputPin(0, true, false);
    await chip.outputPin(1, true, false);
    await chip.outputPin(2, true, false);
    await chip.outputPin(3, true, false);
    // Then define pins 4-7 as inverted inputs
    await chip.inputPin(7, true);
    await chip.inputPin(6, true);
    await chip.inputPin(5, true);
    await chip.inputPin(4, true);
    // Then toggle pin 1 (on)
    await chip.setPin(1);
    // Then delay 1 second
    await sleepMs(1000);
    // Then toggle pin 1 (off)
    await chip.setPin(1);
    // Then delay 1 second
    await sleepMs(1000);
    // Then toggle pin 2 (on)
    await chip.setPin(2);
    // Then delay 1 second
    await sleepMs(1000);
    // Then toggle pin 2 (off)
    await chip.setPin(2);
    // Delay 1 second
    await sleepMs(1000);
    // Add an event listener on the 'input' event
    chip.on('input', (data) => {
        console.log('input', data);
        switch (data.pin) {
            case 7:
                // setPinReturns a promise which we do not wait for.
                chip.setPin(3, data.value);
                break;
            case 6:
                // setPinReturns a promise which we do not wait for.
                chip.setPin(2, data.value);
                break;
            case 5:
                // setPinReturns a promise which we do not wait for.
                chip.setPin(1, data.value);
                break;
            case 4:
            default:
                // setPinReturns a promise which we do not wait for.
                chip.setPin(0, data.value);
                break;
        }
    });
    // It has been observed that when a chip has been configured for interrupts, a condition exists where an interrupt can be missed
    // or when an interrupt is serviced, the actual state of the input pins read from the chip does not reflect the physical state.
    //
    // This has been seen with newer versions epoll (used by the GPIO package).  This condition can also occur when the NodeJS event loop
    // is blocked by a synchronous operation.
    //
    // After a short time period, the chip can be polled again and the actual input pin states will 'settle'.
    // For this reason, the IO expander implementation supports an 'interrupt' event that is fired after an interrupt is processed.
    //
    // For this example, after the last interrupt is processed, we create a post interrupt timeout that will be executed in the future.
    // What we have done here is to create a timeout when the interrupt completes and for every subsequent interrupt that occurs,
    // we 'reset' (clear and recreate) the time period for the poll.
    chip.on('interrupt', function (_processed) {
        createPostInterruptTimeout(POST_INTERRUPT_DELAY_TIME_MS);
    });
    // Then enable interrupt detection on BCM pin 17 (which is GPIO.0)
    // Alternatively you can use for example an interval for manually poll every 250ms
    // setInterval(chip.doPoll.bind(chip), 250);
    await chip.enableInterrupt(17);
};
// Run the example
example();
