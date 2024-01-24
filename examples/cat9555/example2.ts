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
    return pcf.enableInterrupt(18)
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

  // Then delay 1 second
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

  // Then delay 1 second
  .then(() => new Promise((resolve) => {
    setTimeout(resolve, 1000);
  }));

// Add an event listener on the 'input' event
pcf.on('input', (data: CAT9555.InputData) => {
  console.log('input', data);
  switch(data.pin) {
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

function clearPostInterruptTimeout() : void {
  if (_postInterruptTimeout) {
    clearTimeout(_postInterruptTimeout);
    _postInterruptTimeout = null;
  }
}

function createPostInterruptTimeout(delayTimeMs: number) : void {
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
process.on('SIGINT', async() => {
  clearPostInterruptTimeout();
  await pcf.close();
  i2cBus.closeSync();
});
