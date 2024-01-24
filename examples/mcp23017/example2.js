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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
// Import the MCP23017 class
//import { MCP23017 } from '@lynniemagoo/i2c-io-expanders';
var __1 = require("../../");
// Import the i2c-bus module and open the bus
var i2c_bus_1 = require("i2c-bus");
var i2cBus = (0, i2c_bus_1.openSync)(1);
// Define the address of the MCP23017 (0x20)
var addr = 0x27;
var pcf = new __1.MCP23017(i2cBus, addr);
// Note the missing ; at the end of the following lines.
// This is a Promise chain!
// Init a new MCP23017 with all pins high by default
// Instead of 'true' you can also use a 8-bit binary notation to define each
// pin separately, e.g. 0b0000000000101010
pcf.initialize(true)
    // Then enable interrupt detection on BCM pin 18 (which is GPIO.0)
    .then(function () {
    // Alternatively you can use for example an interval for manually poll every 250ms
    // setInterval(pcf.doPoll.bind(pcf), 250);
    return pcf.enableInterrupt(18);
})
    // Then define pins 4-7 as inverted output initially false (off)
    .then(function () {
    return pcf.outputPin(4, true, false);
})
    .then(function () {
    return pcf.outputPin(5, true, false);
})
    .then(function () {
    return pcf.outputPin(6, true, false);
})
    .then(function () {
    return pcf.outputPin(7, true, false);
})
    // Then define pins 0-3 as inverted inputs
    .then(function () {
    return pcf.inputPin(3, true);
})
    .then(function () {
    return pcf.inputPin(2, true);
})
    .then(function () {
    return pcf.inputPin(1, true);
})
    .then(function () {
    return pcf.inputPin(0, true);
})
    // Then toggle pin 5 (on)
    .then(function () {
    return pcf.setPin(5);
})
    // Then delay 1 second
    .then(function () { return new Promise(function (resolve) {
    setTimeout(resolve, 1000);
}); })
    // Then toggle pin 5 (off)
    .then(function () {
    return pcf.setPin(5);
})
    // Then delay 1 second
    .then(function () { return new Promise(function (resolve) {
    setTimeout(resolve, 1000);
}); })
    // Then toggle pin 6 (on)
    .then(function () {
    return pcf.setPin(6);
})
    // Then delay 1 second
    .then(function () { return new Promise(function (resolve) {
    setTimeout(resolve, 1000);
}); })
    // Then toggle pin 6 (off)
    .then(function () {
    pcf.setPin(6);
})
    // Then delay 1 second
    .then(function () { return new Promise(function (resolve) {
    setTimeout(resolve, 1000);
}); });
// Add an event listener on the 'input' event
pcf.on('input', function (data) {
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
var _postInterruptTimeout = null;
var POST_INTERRUPT_DELAY_TIME_MS = 10000;
function clearPostInterruptTimeout() {
    if (_postInterruptTimeout) {
        clearTimeout(_postInterruptTimeout);
        _postInterruptTimeout = null;
    }
}
function createPostInterruptTimeout(delayTimeMs) {
    clearPostInterruptTimeout();
    _postInterruptTimeout = setTimeout(function () {
        console.log('Last interrupt occurred %oms ago.  Will now poll chip', delayTimeMs);
        // doPoll() returns a promise that we are not waiting on here.
        pcf.doPoll();
    }, delayTimeMs);
}
pcf.on('interrupt', function (_processed) {
    createPostInterruptTimeout(POST_INTERRUPT_DELAY_TIME_MS);
});
// Handler for clean up on SIGINT (ctrl+c)
process.on('SIGINT', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                clearPostInterruptTimeout();
                return [4 /*yield*/, pcf.close()];
            case 1:
                _a.sent();
                i2cBus.closeSync();
                return [2 /*return*/];
        }
    });
}); });
