/*
 * Node.js CAT9555
 *
 * Copyright (c) 2017-2024 Peter Müller <peter@crycode.de> (https://crycode.de)
 *               2024 - CAT9555 support developed by Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a CAT9555 I2C port expander IC.
 *
 * This example is showing you how to setup and use inputs and outputs.
 */

// Import the CAT9555 class
//import { CAT9555 } from 'i2c-io-expanders';
import { CAT9555 } from '../../';

// Import the i2c-bus module and open the bus
import {I2CBus, openSync as I2CBusOpenSync} from 'i2c-bus';
const i2cBus: I2CBus = I2CBusOpenSync(1);

// Define a sleep Helper
const sleepMs = (ms: number) : Promise<void> => new Promise((resolve) => {setTimeout(resolve, ms);})

// Define the address of the CAT9555 (0x20)
const addr: number = 0x27;

// Create an instance of the chip.
const chip: CAT9555 = new CAT9555(i2cBus, addr);

// See notes below regarding the 'interrupt' event.
let _postInterruptTimeout = null;
const POST_INTERRUPT_DELAY_TIME_MS: number = 1000;

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
    chip.doPoll();
  }, delayTimeMs);
}

const example = async () : Promise<void> => {

  // Handler for clean up on SIGINT (ctrl+c)
  process.on('SIGINT', async () => {
    clearPostInterruptTimeout();
    await chip.close();
    i2cBus.closeSync();
  });

  // Init a new CAT9555 with all pins high by default
  // Instead of 'true' you can also use a 16-bit binary notation to define each
  // pin separately, e.g. 0b0000000000101010
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
  chip.on('input', (data: CAT9555.InputData) => {
    console.log('input', data);
    switch(data.pin) {
      case 7:
        // setPin returns a promise which we do not wait for.
        chip.setPin(3, data.value);
        break;
      case 6:
        // setPin returns a promise which we do not wait for.
        chip.setPin(2, data.value);
        break;
      case 5:
        // setPin returns a promise which we do not wait for.
        chip.setPin(1, data.value);
        break;
      case 4:
      default:
        // setPin returns a promise which we do not wait for.
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
  chip.on('interrupt', function (_processed: boolean) {
    createPostInterruptTimeout(POST_INTERRUPT_DELAY_TIME_MS);
  });

  // Then enable interrupt detection on BCM pin 18 (which is GPIO.1)
  // Alternatively you can use for example an interval for manually poll every 250ms
  // setInterval(chip.doPoll.bind(chip), 250);
  await chip.enableInterrupt(18);
};

// Run the example
example();