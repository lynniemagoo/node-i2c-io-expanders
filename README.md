# Various i2c-io-expanders (cat9555, mcp23017, mcp23008, pcf8574/pcf8575)

**MCP23017 (MCP23017A/B)**, **MCP23008**, **CAT9555** are modeled after **PCF8574/PCF8575** module created by Peter Müller <peter@crycode.de> (https://crycode.de/)

Control each pin of a I2C port expander IC.

The PCF8574 is a 8 bit/pin port expander IC, which can be controlled over the I2C-Bus.  
The PCF8575 is a 16 bit/pin port expander IC, which can be controlled over the I2C-Bus.  
The CAT9555 is a 16 bit/pin port expander IC, which can be controlled over the I2C-Bus.  
The MCP23017 is a 16 bit/pin port expander IC, which can be controlled over the I2C-Bus.  
The MCP23008 is a 8 bit/pin port expander IC, which can be controlled over the I2C-Bus.

Each of the pins can be separately used as an input or output.
It also offers an interrupt signal, which can be used to detect input changes by the I2C master (e.g. a Raspberry Pi).

For more information about the PCF8574/PCF8574A please consult the [datasheet from Texas Instruments](http://www.ti.com/lit/ds/symlink/pcf8574.pdf).  
For more information about the PCF8575 please consult the [datasheet from Texas Instruments](https://www.ti.com/lit/ds/symlink/pcf8575.pdf).  
For more information about the CAT9555 please consult the [datasheet from On Semiconductor (ONSEMI)](https://www.onsemi.com/pdf/datasheet/cat9555-d.pdf).  
For more information about the MCP23017 please consult the [datasheet from Microchip Technology](https://ww1.microchip.com/downloads/en/devicedoc/20001952c.pdf).  
For more information about the MCP23008 please consult the [datasheet from Microchip Technology](https://ww1.microchip.com/downloads/en/DeviceDoc/MCP23008-MCP23S08-Data-Sheet-20001919F.pdf).

**Supported (tested) Node.js versions:** 10, 12, 14, 16, 18, 20

**IMPORTANT: The MCP23017 IC supports physical separation into two Ports (A and B) each supporting a separate interrupt pin.  The simple MCP23017 implementation in this package abstracts both 8-pin Ports (A and B) into a single device of 16 pins.  To support this configuration, interrupts are 'Mirrored' meaning that you can connect InterruptA or InterruptB pins to your CPU for processing interrupts.**

**Additionally, this package provides the ability to address IC Ports independently via the MPC23017A and MCP23017B constructors.  In this configuration, interrupts are not 'Mirrored' meaning that depending on your needs, you connect the required pin, either InterruptA or InterruptB to your CPU for processing interrupts.**

**For all MCP23017 implementations, interrupts are configured as 'Open-Drain'. See the MCP23017 examples folder as well as the  the MCP23017 datasheet for more details.**

## Installation

```sh
npm install i2c-io-expanders
```

TypeScript typings are included in this package.

You should be able to use this module on any Linux based OS.

To use the interrupt detection you need a Raspberry Pi or a similar board.

## Examples

Note that you need to construct the [i2c-bus](https://npmjs.org/package/i2c-bus) object
and pass it in to the module along with the I2C address of the expander chip.

The PCF8574 example below can be found in the [examples directory](https://github.com/lynniemagoo/node-i2c-io-expanders/tree/master/examples/pcf8574) of this package together with a TypeScript example.

```js
// Require the PCF8574 class from the i2c-io-expanders module
//const PCF8574 = require('i2c-io-expanders').PCF8574;
const PCF8574 = require('../../').PCF8574;

// Require the i2c-bus module and open the bus
const i2cBus = require('i2c-bus').openSync(1);

// Define a sleep Helper
const sleepMs = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Define the address of the PCF8574 (0x20) /PCF8574A (0x38)
const addr = 0x20;

// Create an instance of the chip.
const chip = new PCF8574(i2cBus, addr);

const example = async () => {

  // Handler for clean up on SIGINT (ctrl+c)
  process.on('SIGINT', async () => {
    await chip.close();
    i2cBus.closeSync();
  });

  // Init a new PCF8574 with all pins high by default
  // Instead of 'true' you can also use a 8-bit binary notation to define each
  // pin separately, e.g. 0b00101010
  await chip.initialize(true);
  
  // Then define pin 0 as inverted output with initally false
  await chip.outputPin(0, true, false);
  
  // Then define pin 1 as inverted output with initally true
  await chip.outputPin(1, true, true);
  
  // Then define pin 7 as non inverted input
  await chip.inputPin(7, false);
  
  // Then delay 1 second
  await sleepMs(1000);

  // Then turn pin 0 on
  console.log('turn pin 0 on');
  await chip.setPin(0, true);

  // Then delay 1 second
  await sleepMs(1000);

  // Then turn pin 0 off
  console.log('turn pin 0 off');
  await chip.setPin(0, false);

  // Add an event listener on the 'input' event
  chip.on('input', (data) => {
    console.log('input', data);
    // Check if a button attached to pin 7 is pressed (signal goes low)
    if (data.pin === 7 && data.value === false) {
      // setPin returns a promise which we do not wait for.
      // Toggle pin 1
      chip.setPin(1);
    }
  });

  // Then enable interrupt detection on BCM pin 17 (which is GPIO.0)
  // Alternatively you can use for example an interval for manually poll every 250ms
  // setInterval(chip.doPoll.bind(chip), 250);
  await chip.enableInterrupt(17);
};

// Run the example
example();
```

## API

The API uses **Events** for detected input changes and **Promises** for all asynchronous actions.

Input changes can be detected in two ways:

* Using a GPIO to observe the interrupt signal from the expander IC. *Recommended on Raspberry Pi or similar.*
* Call `doPoll()` manually frequently enough to actively read the current states. This leads to a higher load on the I2C-Bus.

If a pin is defined as an input and a changed state is detected, an `input` Event will be emitted with an object containing the `pin` number and the new `value` of this pin.

You can set an inverted flag for each pin separately, which will result in an inverted input or output.
If an inverted input has a low level it will be interpreted as true and a high level will be false.
An inverted output will write a low level if you set it to true and write a high level if false.

Applications may also register for an 'interrupt' event that is fired upon completion of interrupt processing.  See the Example2 sample file for each chip for additional information.

### new PCF8574(i2cBus, address)

```ts
constructor (i2cBus: I2CBus, address: number);
```

Constructor for a new PCF8574 instance.

* `i2cBus` - Instance of an opened i2c-bus.
* `address` - The address of the PCF8574 IC.

Note that you need to construct the [i2c-bus](https://npmjs.org/package/i2c-bus) object and pass it in to the module.

If you use this expander IC with one or more input pins, you have to call

* `enableInterrupt(gpioPin)` to detect interrupts from the expander IC using a GPIO pin, or
* `doPoll()` frequently enough to detect input changes with manually polling.

### new PCF8575(i2cBus, address)

```ts
constructor (i2cBus: I2CBus, address: number);
```

Constructor for a new PCF8575 instance.

* `i2cBus` - Instance of an opened i2c-bus.
* `address` - The address of the PCF8575 IC.

Note that you need to construct the [i2c-bus](https://npmjs.org/package/i2c-bus) object and pass it in to the module.

If you use this expander IC with one or more input pins, you have to call

* `enableInterrupt(gpioPin)` to detect interrupts from the expander IC using a GPIO pin, or
* `doPoll()` frequently enough to detect input changes with manually polling.

### new CAT9555(i2cBus, address)

```ts
constructor (i2cBus: I2CBus, address: number);
```

Constructor for a new CAT9555 instance.

* `i2cBus` - Instance of an opened i2c-bus.
* `address` - The address of the CAT9555 IC.

Note that you need to construct the [i2c-bus](https://npmjs.org/package/i2c-bus) object and pass it in to the module.

If you use this expander IC with one or more input pins, you have to call

* `enableInterrupt(gpioPin)` to detect interrupts from the expander IC using a GPIO pin, or
* `doPoll()` frequently enough to detect input changes with manually polling.

### new MCP23017(i2cBus, address)

```ts
constructor (i2cBus: I2CBus, address: number);
```

Constructor for a new MCP23017 instance.

* `i2cBus` - Instance of an opened i2c-bus.
* `address` - The address of the MCP23017 IC.

Note that you need to construct the [i2c-bus](https://npmjs.org/package/i2c-bus) object and pass it in to the module.

If you use this expander IC with one or more input pins, you have to call

* `enableInterrupt(gpioPin)` to detect interrupts from the expander IC using a GPIO pin, or
* `doPoll()` frequently enough to detect input changes with manually polling.

### new MCP23017A(i2cBus, address)

```ts
constructor (i2cBus: I2CBus, address: number);
```

Constructor for a new MCP23017A instance to address pins on Port A of the MCP23017 IC.

* `i2cBus` - Instance of an opened i2c-bus.
* `address` - The address of the MCP23017 IC.

Note that you need to construct the [i2c-bus](https://npmjs.org/package/i2c-bus) object and pass it in to the module.

If you use this expander IC with one or more input pins, you have to call

* `enableInterrupt(gpioPin)` to detect interrupts from the expander IC using a GPIO pin, or
* `doPoll()` frequently enough to detect input changes with manually polling.

### new MCP23017B(i2cBus, address)

```ts
constructor (i2cBus: I2CBus, address: number);
```

Constructor for a new MCP23017B instance to address pins on Port B of the MCP23017 IC.

* `i2cBus` - Instance of an opened i2c-bus.
* `address` - The address of the MCP23017 IC.

Note that you need to construct the [i2c-bus](https://npmjs.org/package/i2c-bus) object and pass it in to the module.

If you use this expander IC with one or more input pins, you have to call

* `enableInterrupt(gpioPin)` to detect interrupts from the expander IC using a GPIO pin, or
* `doPoll()` frequently enough to detect input changes with manually polling.

### new MCP23008(i2cBus, address)

```ts
constructor (i2cBus: I2CBus, address: number);
```

Constructor for a new MCP23008 instance to address pins of the MCP23008 IC.

* `i2cBus` - Instance of an opened i2c-bus.
* `address` - The address of the MCP23008 IC.

Note that you need to construct the [i2c-bus](https://npmjs.org/package/i2c-bus) object and pass it in to the module.

If you use this expander IC with one or more input pins, you have to call

* `enableInterrupt(gpioPin)` to detect interrupts from the expander IC using a GPIO pin, or
* `doPoll()` frequently enough to detect input changes with manually polling.

### initialize(initialHardwareState)

```ts
initialize(initialHardwareState?: boolean | number): Promise<void>;
```

Initialize the chip.  

* `initialHardwareState` - Optional initial hardware state for the pins of this expander IC.  You can set a bitmask (e.g. *0b00101010* or *0b0000000000101010*) to define each pin separately, or use true/false for all pins at once.  **Note:  This is the physical hardware value to be assigned for each pin at startup and does NOT take into consideration the 'invert' status per pin.**

### enableInterrupt(gpioPin)

```ts
enableInterrupt (gpioPin: <IOChipConstructor>.PinNumber): Promise<void>;
```

Enable the interrupt detection on the specified GPIO pin.
You can use one GPIO pin for multiple instances of any mixture of expander IC instances (PCF8754, PCF8575, CAT9555, MCP23017, MCP23017A, MCP23017B, MCP23008).  

* `gpioPin` - BCM number of the pin, which will be used for the interrupts from the expander IC.

### disableInterrupt()

```ts
disableInterrupt (): Promise<void>;
```

Disable the interrupt detection.
This will unexport the interrupt GPIO, if it is not used by an other instance of this class.

### doPoll()

```ts
doPoll (): Promise<number>;
```

Manually poll changed inputs from the expander IC.

If a change on an input is detected, an `input` Event will be emitted with a data object containing the `pin` and the new `value`.
This have to be called frequently enough if you don't use a GPIO for interrupt detection.
Internally any poll operation is queued.  There can be at most 3 + number of pins on the expander IC active at any one time (i.e. 11 on PCF8574).
If you reach this limit, the promise will be rejected with an error.
Returns a Promise which will be resolved with a bitmask representing the internal state of the pins following a read from the expander IC.

### outputPin(pin, inverted, initialValue)

```ts
outputPin (pin: <IOChipConstructor>.PinNumber, inverted: boolean, initialValue?: boolean): Promise<void>;
```

Define a pin as an output.
This marks the pin to be used as an output pin.
Returns a Promise which will be resolved when the pin is ready.

* `pin` - The pin number. (0 to 15)
* `inverted` - true if this pin should be handled inverted (true=low, false=high)
* `initialValue` - (optional) The initial value of this pin, which will be set immediately.

### inputPin(pin, inverted)

```ts
inputPin (pin: <IOChipConstructor>.PinNumber, inverted: boolean): Promise<number>;
```

Define a pin as an input.
This marks the pin for input processing and activates the high level on this pin.
Returns a Promise which will be resolved with a bitmask representing the internal state of the pins following a read from the expander IC.

* `pin` - The pin number. (0 to 7 | 15)
* `inverted` - true if this pin should be handled inverted (high=false, low=true)

Note that an input is always set to high (pullup) internally.

### setPin(pin, value)

```ts
setPin (pin: <IOChipConstructor>.PinNumber, value?: boolean): Promise<void>;
```

Set the value of an output pin.
If no value is given, the pin will be toggled.
Returns a Promise which will be resolved when the new value is written to the expander IC.

* `pin` - The pin number. (0 to 7 | 15)
* `value` - Optional new value for this pin.

### setAllPins(value)

```ts
setAllPins (value: boolean | number): Promise<void>;
```

Set the given value to all output pins.  If a number is supplied, the bits in this number will be applied to output pins only.
Returns a Promise which will be resolved when the new values are written to the expander IC.

* `value` - The new value for this pin.

### getPinValue(pin)

```ts
getPinValue (pin: <IOChipConstructor>.PinNumber): Promise<boolean>;
```

Returns a Promise which will be resolved to the current value of the pin or rejected if pin out of range.
This returns the last saved value, not the value currently returned by the expander IC.
To get the current value call doPoll() first, if you're not using interrupts.

* `pin` - The pin number. (0 to 7 | 15)

## License

Licensed under GPL Version 2

Copyright (c) 2023-2024 Lyndel McGee <lynniemagoo@yahoo.com>  
Copyright (c) 2017-2024 Peter Müller <peter@crycode.de> (<https://crycode.de/>)  
