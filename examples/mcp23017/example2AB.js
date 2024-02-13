/*
 * Node.js MCP23017AB - Example showing utilization of both Port A and Port B
 *                      as separate instances, with each Port supporting
 *                      non-mirrored open-drain interrupts.
 *
 * Copyright (c) 2017-2024 Peter Müller <peter@crycode.de> (https://crycode.de)
 *               2024 - MCP23017 support developed by Lyndel McGee <lynniemagoo@yahoo.com>
 *
 * Node.js module for controlling each pin of a MCP23017 I2C port expander IC.
 *
 * This example is showing you how to setup and use inputs and outputs.
 */

// Require the MCP23017A and MCP23017B class from the i2c-io-expanders module
//const { MCP23017A, MCP23017B } = require('i2c-io-expanders');
const {MCP23017A, MCP23017B} = require("../../");

// Require the i2c-bus module and open the bus
const i2cBus = require('i2c-bus').openSync(1);

// Define a sleep Helper
const sleepMs = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Define the address of the MCP23017 (0x20)
const addr = 0x27;

//============================================================================================================================
// The MCP23017 implementation provided here provides separation of physical Ports A and B of the MCP23017 chip.
// PortA pins 0-7 => Pins 0-7
// PortB pins 0-7 => Pins 0-7
//
// To support this configuration, interrupts are NOT configured as 'mirrored'.  Therefore, your application must use the
// correct chip interrupt pin for either PortA or PortB. Interrupts are also configured as 'open-drain' so external
// pullup resistors must be provided.
//============================================================================================================================

// Create instances of the chip.
const chipPortA = new MCP23017A(i2cBus, addr);
const chipPortB = new MCP23017B(i2cBus, addr);

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
    chipPortA.doPoll();
  }, delayTimeMs);
}

const example = async () => {
  // Handler for clean up on SIGINT (ctrl+c)
  process.on('SIGINT', async () => {
    clearPostInterruptTimeout();
    await chipPortA.close();
    await chipPortB.close();
    i2cBus.closeSync();
  });

  // Init new MCP23017 instances with all pins high by default
  // Instead of 'true' you can also use a 8-bit binary notation to define each
  // pin separately, e.g. 0b00101010
  await chipPortA.initialize(true);
  await chipPortB.initialize(true);

  // Then define PortB pins 4-7 (B4-B7) as inverted output initially false (off)
  await chipPortB.outputPin(4, true, false);
  await chipPortB.outputPin(5, true, false);
  await chipPortB.outputPin(6, true, false);
  await chipPortB.outputPin(7, true, false);

  // Then define PortA pins 0-3 (A0-A3) as inverted inputs
  await chipPortA.inputPin(3, true);
  await chipPortA.inputPin(2, true);
  await chipPortA.inputPin(1, true);
  await chipPortA.inputPin(0, true);

  // Then toggle PortB pin 5 (on)
  await chipPortB.setPin(5);

  // Then delay 1 second
  await sleepMs(1000);

  // Then toggle PortB pin 5 (off)
  await chipPortB.setPin(5);

  // Then delay 1 second
  await sleepMs(1000);

  // Then toggle PortB pin 6 (on)
  await chipPortB.setPin(6);

  // Then delay 1 second
  await sleepMs(1000);

  // Then toggle PortB pin 6 (off)
  await chipPortB.setPin(6);

  // Delay 1 second
  await sleepMs(1000);

  // Add an event listener on the 'input' event for PortA
  chipPortA.on('input', (data) => {
    console.log('input', data);
    switch (data.pin) {
      case 3:
        // setPinReturns a promise which we do not wait for.
        chipPortB.setPin(7, data.value);
        break;
      case 2:
        // setPinReturns a promise which we do not wait for.
        chipPortB.setPin(6, data.value);
        break;
      case 1:
        // setPinReturns a promise which we do not wait for.
        chipPortB.setPin(5, data.value);
        break;
      case 0:
      default:
        // setPinReturns a promise which we do not wait for.
        chipPortB.setPin(4, data.value);
        break;
    }
  });
  
  // Then enable interrupt detection for PortA on BCM pin 18 (which is GPIO.1)
  // Alternatively you can use for example an interval for manually poll every 250ms
  // setInterval(chip.doPoll.bind(chip), 250);
  await chipPortA.enableInterrupt(18);
  
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
  chipPortA.on('interrupt', function (_processed) {
    createPostInterruptTimeout(POST_INTERRUPT_DELAY_TIME_MS);
  });
};

// Run the example
example();