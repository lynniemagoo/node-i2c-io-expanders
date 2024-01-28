"use strict";
/*
 * Node.js MCP23017
 *
 * Copyright (c) 2017-2024 Peter Müller <peter@crycode.de> (https://crycode.de)
 *               2024 - MCP23017 support developed by Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a MCP23017 I2C port expander IC.
 *
 * This example is showing you how to setup and use inputs and outputs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Import the MCP23017 class
//import { MCP23017 } from 'i2c-io-expanders';
const __1 = require("../../");
// Import the i2c-bus module and open the bus
const i2c_bus_1 = require("i2c-bus");
const i2cBus = (0, i2c_bus_1.openSync)(1);
// Define a sleep Helper
const sleepMs = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
// Define the address of the MCP23017 (0x20)
const addr = 0x27;
//============================================================================================================================
// The MCP23017 implementation provided here groups the physical Ports A and B of the MCP23017 chip into a single set of pins
// PortA pins 0-7 => Pins 0-7
// PortB pins 0-7 => Pins 8-15
//
// To support this configuration, interrupts are also configured as 'mirrored'.  Therefore, your application can choose to connect
// either of the interrupt pins of the chip to a single GPIO of your CPU.
//
// Future implementations of this package may provide the capability to configure individual instances to address either PortA
// or PortB. i.e. MCP23017A or MCP23107B
//============================================================================================================================
// Create an instance of the chip.
const chip = new __1.MCP23017(i2cBus, addr);
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
    // Init a new MCP23017 with all pins high by default
    // Instead of 'true' you can also use a 8-bit binary notation to define each
    // pin separately, e.g. 0b0000000000101010
    await chip.initialize(true);
    // Then define pins 4-7 (A4-A7) as inverted output initially false (off)
    await chip.outputPin(4, true, false);
    await chip.outputPin(5, true, false);
    await chip.outputPin(6, true, false);
    await chip.outputPin(7, true, false);
    // Then define pins 0-3 (A0-A3) as inverted inputs
    await chip.inputPin(3, true);
    await chip.inputPin(2, true);
    await chip.inputPin(1, true);
    await chip.inputPin(0, true);
    // Then toggle pin 5 (on)
    await chip.setPin(5);
    // Then delay 1 second
    await sleepMs(1000);
    // Then toggle pin 5 (off)
    await chip.setPin(5);
    // Then delay 1 second
    await sleepMs(1000);
    // Then toggle pin 6 (on)
    await chip.setPin(6);
    // Then delay 1 second
    await sleepMs(1000);
    // Then toggle pin 6 (off)
    await chip.setPin(6);
    // Delay 1 second
    await sleepMs(1000);
    // Add an event listener on the 'input' event
    chip.on('input', (data) => {
        console.log('input', data);
        switch (data.pin) {
            case 3:
                // setPinReturns a promise which we do not wait for.
                chip.setPin(7, data.value);
                break;
            case 2:
                // setPinReturns a promise which we do not wait for.
                chip.setPin(6, data.value);
                break;
            case 1:
                // setPinReturns a promise which we do not wait for.
                chip.setPin(5, data.value);
                break;
            case 0:
            default:
                // setPinReturns a promise which we do not wait for.
                chip.setPin(4, data.value);
                break;
        }
    });
    // Then enable interrupt detection on BCM pin 18 (which is GPIO.1)
    // Alternatively you can use for example an interval for manually poll every 250ms
    // setInterval(chip.doPoll.bind(chip), 250);
    await chip.enableInterrupt(18);
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
};
// Run the example
example();
