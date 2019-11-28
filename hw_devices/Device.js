"use strict";

const	Logger 		= require("../utils/Logger.js").Logger;
const	isMissing 	= require("../utils/Logger.js").isMissing;
const	isPresent 	= require("../utils/Logger.js").isPresent;
var 	Gpio; // GPIO lib (or emulation)

// =========================================================================================================

class Device {

	// This class represents a generic device which is connected to a gpio.
	
	constructor(id,name,gpios,emulate) {
		this.id			= id;
		this.name		= name;
		this.gpios		= gpios;
		this.protocol	= "on/off";
		this.emulate	= emulate;		
		this.dev		= null;
	}
	
	onChanged(watcher) {
		// define a method to be called whenever the state of the device changes
		this.watcher=watcher;
	}
	
	getValue() {
		// must be overridden in derived classes
		return "?";
	}
	
	toString() {
		return this.constructor.name+" "+this.name+" "+JSON.stringify(this.gpios);
	}
	
	release() {
		// to be overwritten in subclass if necessary
		// Logger.info("Device       releasing "+this.toString());
	}
		
}

// =========================================================================================================

class Label extends Device {
	// a text label, typically sitting somewhere on the hardware front panel
	
	constructor(id,name) {
		super(id,name,[],false);
		this.protocol="";
	}
	
}

// =========================================================================================================

class Display extends Device {
	// a text display, sitting somewhere on the hardware front panel
	
	constructor(id,name,xDim,yDim) {
		super(id,name,[],false);
		this.xDim		= xDim;
		this.yDim		= yDim;
		this.direction	= "out";
		this.contents	= [];
		for (var y=0;y<yDim;y++) this.contents.push("");
		this.clear();
	}

	clear() {
		for (var y=0;y<this.yDim;y++) this.contents[y]="";
		this.yPos=0;
	}

	println(text) {
		Logger.log("Display      "+text);
		this.contents[this.yPos]=text.substr(0,this.xDim);	// ignore horizontal overflow
		if(++this.yPos>this.yDim) {
			this.contents.shift();
			this.yPos--;
		}
		if (this.watcher) this.watcher(0,this,"Display",this.contents);
	}
	
	getValue() {
		return this.contents;
	}
	
	setValue(val) {
		this.println(""+val);
	}
	
}
Display.getApiDescription = function () {	
	return [
		{	cmd:"getValue",
			effect:"returns the current contents of the display (array of text lines)"
		},
		{	cmd:"println",
			args: [
				{ name : "text",	meaning: "text line" },
			],
			effect:"appends one line of text"
		},
	];
}


// =========================================================================================================

class TextInput extends Device {
	// a text input area, sitting somewhere on the hardware front panel
	
	constructor(id,name,cols,rows) {
		super(id,name,[],false);
		this.cols		= cols;
		this.rows		= rows;
		this.direction	= "in";
		this.contents	= [];
		for (var r=0;r<rows;r++) this.contents.push("");
		this.clear();
		Logger.info("TextInput    creating field: "+cols+" x "+rows);
	}

	clear() {
		for (var r=0;r<this.rows;r++) this.contents[r]="";
	}

	getValue() {
		return this.contents;
	}
	
	setValue(val) {
		Logger.log("TextInput    "+text);
		this.contents=val;
		if (this.watcher) this.watcher(0,this,"TextInput",this.contents);
	}
	
}
TextInput.getApiDescription = function () {	
	return [
		{	cmd:	"setValue",
			effect:	"simulates a text input",
			args: [
				{ name: "val", meaning: "a line of text" },
			],
		},
	];
}


// =========================================================================================================

class IODevice extends Device {

	// This class represents a generic device which is connected to a single gpio.
	
	constructor(id,name,gpio,direction,emulate) {
		// expects the (output) gpio (BCM notation) for the device

		super(id,name,[gpio],emulate);
		this.gpio	= gpio;
		this.direction = direction;
		this.watcher = null;

		// if gpio==0 the device is not directly connected to a GPIO
		if (gpio==0) {
			this.dev=null;
			return;
		}
		// import a class to access the GPIO port (emulation or real hardware access)
		if (this.emulate)	Gpio = require('../hw_protocols/GpioWin').GpioWin;
		else 				Gpio = require('onoff').Gpio;

		this.dev = new Gpio(gpio, direction);
	}
	
	release() {
		Logger.info("Device       releasing "+this.toString());
		if (this.dev) this.dev.unexport();
	}
	
	getValue() {
		return this.dev ? this.dev.readSync() : -1;
	}
		
	isOn() {
		return this.dev.readSync()===Gpio.HIGH;
	}

	isOff() {
		return this.dev.readSync()==Gpio.LOW;
	}
	
	onChanged(watcher,useInterrupts) {
		// define a method to be called whenever the signal changes

		this.watcher=watcher;
		if (!useInterrupts || !this.dev) return;
		
		var that=this;
		this.dev.watch(function(err,value,gpio) {
			if (err) { Logger.error("gpio watching "+that.gpio); return; }
			Logger.log("IODevice     signal changed: "+that.constructor.name+":"+that.id+", value="+value+" at gpio "+gpio);
			that.watcher(0,that,that.constructor.name,value);
		});
	}

	toString() {
		return this.constructor.name+" "+this.name+" "+this.gpio+" "+this.direction;
	}
	
}

// =========================================================================================================

class InputDevice extends IODevice {

	// This class represents a generic input device which is connected to a gpio.
	
	constructor(id,name,gpio,emulate) {
		super(id,name,gpio,"in",emulate);		
	}
	
}

// =========================================================================================================

class Button extends InputDevice {

	// This class represents a physical on-off-button connected to a gpio.
	// it uses the gpio utility (wiringPi) to configure the gpio as input with a pullup resistor.
	
	constructor(id,name,gpio,debounce,direction,emulate) {
		// create a debounce-protected button 
		// Only rising edges will trigger an interrupt
		
		super(id,name,gpio,emulate);
		// we need to substitute the gpio by a new definition
		// so that we can add the debounce time
		Logger.info("Button       creating "+name+" at gpio "+gpio+ ", using gpio utility to enable pullup");
		if (!this.emulate) require('child_process').execSync("gpio -g mode "+gpio+" up");
		if (direction=="" || direction=="rising") {
			this.dev = new Gpio(gpio,"in","rising",{debounceTimeout:debounce,activeLow:true});
		}
		else if (direction=="both") {
			this.dev = new Gpio(gpio,"in","both",{debounceTimeout:debounce,activeLow:true});
		}
	}

	onPressed(watcher,useInterrupts) {
		// define a method to be called whenever the signal changes due to a "pressed" action

		this.onPressedWatcher=watcher;
		if (!useInterrupts) return;
		
		var that=this;
		this.dev.watch(function(err,value,gpio) {
			if (err) { Logger.error("gpio watching for Pressed "+that.gpio); return; }
			Logger.log("IODevice     signal changed: "+that.constructor.name+":"+that.id+", value="+value+" at gpio "+gpio);
			that.onPressedWatcher(0,that,that.constructor.name,value);
		});
	}
		
	press(state) {
		// simulate a button event
		if (state=="pressed") {
			if (this.onPressedWatcher) this.onPressedWatcher(0,this,"Button",1);
		}
		else {
			if (this.watcher) this.watcher(0,this,"Button",state=="down" ? 1 : 0);
		}
	}
}
Button.getApiDescription = function () {	
	return [
		{	cmd:"press",
			effect:"simulates a button press and release action"
		},
		{	cmd:"down",
			effect:"simulates a button which was pushed and is now being held down"
		},
		{	cmd:"up",
			effect:"simulates a button which had been pushed and is now being released"
		},
	];
}

// =========================================================================================================

class OutputDevice extends IODevice {

	// This class represents a generic output device which is connected to a gpio.
	// It offers methods to switch the device on and off and to toggle it.
	
	constructor(id,name,gpio,emulate) {
		super(id,name,gpio,"out",emulate);
	}
		
	setValue(value) {
		if (this.dev) {
			this.dev.writeSync(value);
			// notify a watcher listening to the out port
			// triggering the callback here avois the need to watch for harware interrupts on OUTPUT gpios
		}
		if (this.watcher) this.watcher(0,this,this.constructor.name,value);
	}
	
	on() {
		this.setValue(Gpio.HIGH);
	}
		
	off() {
		this.setValue(Gpio.LOW);
	}
	
	toggle() {
		if (this.isOn()) this.off();
		else			 this.on();
	}
	
	release() {
		this.off();
		super.release();
	}
}

// =========================================================================================================

class LED extends OutputDevice {

	// This class represents a LED which is connected to a gpio
	// It offers methods for blinking.
	
	constructor(id,name,color,gpio,emulate) {
		// expects the (output) gpio# (BCM notation) for the LED
		super(id,name,gpio,emulate);
		this.color=				color;
		this.runTimer=			null;
		this.stopTimer= 		null;
		this.remainingCycles = 	0;
	}
	
	blink(interval,ratio,duration,cycles,finished) {
		// blink in a constant rhythm (_interval_) for some time (_duration_)
		// or for a given number of _cycles_
		
		if (this.stopTimer) {
			Logger.error(this.toString().padEnd(12)+" cannot start blinking; you must first stop the current blinking process.");
			if (isPresent(finished) && finished) finished(this,-1);
			return;
		}
		
		// store args
		this.remainingCycles=	duration>0 ? 0 : cycles;
		this.finished=			finished;
		this.interval=			interval;
		this.ratio=				ratio;
		
		// start toggling, count steps (a step is half a cycle)
		this.step=0;
		this.toggleAfterDelay(this,true);
		
		// end blinking after duration if specified, regardless of cycles
		if (duration>0) {
			var that=this;
			this.stopTimer = setTimeout(function() { that.stop(that); }, duration);
		}
	}

	toggleAfterDelay(that,init) {
		// Trigger the next port switch at the correct moment in time.
		// Note that using a Javascript interval timer would not be very precise; 
		// depending on CPU speed we would see 2..15% delay after some cycles.
		// Instead we set up a new timer each time to meet the next multiple of our interval
		// as closely as possible
		
		var delay = that.step * that.interval + that.blinkStartedAt - new Date().getTime();
		if (that.step%2==1) delay*=(1+(that.ratio-50)*0.02);
		that.step++;
		that.runTimer = setTimeout(
			function() {
				if (init) { // note startup time
					that.blinkStartedAt = new Date().getTime();
					if (that.emulate) that.dev.setTime(that.blinkStartedAt);
					that.on();
					that.toggleAfterDelay(that);
				}
				else if (that.isOn()) {
					that.off();
					that.toggleAfterDelay(that);
				}
				else {
					if (--that.remainingCycles==0) {
						that.stop(that); // stop after final OFF period
					}
					else {
						that.on();
						that.toggleAfterDelay(that);
					}
				}
			},
			init ? 0: delay
		);
	}
	
	stop(that) {
		// stop the current blinking process, clear timers

		var now=new Date().getTime(); // note current time
		
		// reset stopTimer (it may have been scheduled for a later point in time during start of blinking)
		if (that.stopTimer) clearTimeout(that.stopTimer);
		that.stopTimer=null;

		// actually stop blinking, kill runTimer
		clearTimeout(that.runTimer);
		that.runTimer=null;
		
		// invoke finished callback
		if (isPresent(that.finished) && that.finished) that.finished(that,now-that.blinkStartedAt);
		that.blinkStartedAt=0;
	}
	
}
LED.getApiDescription = function () {	
	return [
		{	cmd:"blink",
			args:[
				{name:"delay",		meaning:"a number in msecs between on and off"},
				{name:"ratio",		meaning:"a number between 0..1 to describe the proportion of on-time:off-time"},
				{name:"cycles",		meaning:"the number of full cycles to perform"},
				{name:"duration",	meaning:"the time span for blinking; excess cycles will be ignored"},
			],
			effect:"let the LED blink according to the settings"
		},
		{	cmd:	"toggle",
			effect:	"toggle the current state of the LED between on and off"
		},
		{	cmd:	"getValue",
			effect:	"return 0 or 1 for off/on"
		}
	];
}


// =========================================================================================================

module.exports.Device		= Device;
module.exports.Label		= Label;
module.exports.LED			= LED;
module.exports.Button		= Button;
module.exports.TextInput	= TextInput;
module.exports.Display		= Display;
