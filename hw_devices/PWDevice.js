const Logger 	= require("../utils/Logger.js").Logger;
const isMissing = require("../utils/Logger.js").isMissing;
const isPresent = require("../utils/Logger.js").isPresent;

const Device	= require("./Device.js").Device;

class PWDevice extends Device {
	/*
		Control a HARDWARE-Pulse-Width-Modulated GPIO or a SOFTWARE driven PWM;
		hardware support for PWM is more stable than soft PWM, but it is restricted
		to only 1 or 2 pins depending on the hardware model
		
		Using hardware PWM is useful when controlling servos as with a soft PWM
		you will probably see jitter due to imprecise timing.
		
		The duty cycle can be limited to a subrange between 0..1, say 0.2..1.0.
		An extra lower Limit can be added if values below that limit shall be avoided
		Example: [0,1,0.1] means that the range is from 0..1 but values below 0.1 will
		be set to 0 automatically. This is useful if the device attached to the PWM
		has problems with very small spikes of current.		
	*/
	
	constructor(id,name,gpio,frequency,emulate) {

		super(id,name,[gpio],emulate);
		
		// find the PWM pin
		// note that with a 40-pin connector you can only use GPIO (18 OR 12) AND (13 OR 19)
		// with 26 pins the only choice you have is GPIO==18 (physical pin# 12)
		var pwmPin=0;
		if (gpio==18 || gpio==12) pwmPin=1;	// pin# 12 or 32
		if (gpio==13 || gpio==19) pwmPin=2;	// pin# 33 or 35
		if (pwmPin!=0) {
			this.pwmType = "hard";
		}
		else {
			this.pwmType="soft";
		}
		frequency |= 50;

		this.frequency	= frequency;
		this.period		= Math.round(1000000 / frequency);  // micro secs
		this.pwmRange	= 10000;

		if (this.emulate) {
			this.dev = new (require('../hw_protocols/PWMWin.js').PWMWin)({gpio:gpio, pin:pwmPin,frequency:this.frequency,period:this.period});
		}
		else if (this.pwmType=="hard") {
			this.dev = new (require("raspi-pwm").PWM)({pin:pwmPin,frequency:this.frequency});
		}	
		else {
			const Gpio = require("pigpio").Gpio;
			this.dev = new Gpio(gpio, {mode: Gpio.OUTPUT});
			this.dev.pwmFrequency(this.frequency);
			this.dev.pwmRange(this.pwmRange);
		}
		this.direction	= "out";
		this.watcher	= null;
		this.lowerBound = 0;
		this.upperBound = 1;
		this.extraBound = 0;
		this.dutyCycle	= 0;
	}

	limitDutyCycle(bounds) {
		this.lowerBound=bounds[0];
		this.upperBound=bounds[1];	
		this.extraBound=(bounds.length==3) ? bounds[2] : this.lowerBound;
		Logger.log("PWDevice     limits: "+this.lowerBound+"..."+this.upperBound+"  ("+this.extraBound+")");
	}
	
	setDutyCycle(args) {
		// change the duty cycle instantly to the new value
		
		var value	= args && args.value ? args.value : args;		
		
		if		(this.extraBound>this.lowerBound && value < this.extraBound) value=this.lowerBound;
		else if (value<this.lowerBound) value=this.lowerBound;
		else if (value>this.upperBound) value=this.upperBound;
		this.dutyCycle=value;
		
		if (this.pwmType=="hard") this.dev.write(value);
		else {
			// start pulses always from 0, calculate duration based on value an d frequency
			var duty=Math.round(value*this.pwmRange);
			Logger.log("PWDevice     ["+this.gpios[0]+"]  setDuty "+value+" ("+duty+")");
			this.dev.pwmWrite(duty);
		}
		if (this.watcher) this.watcher(0,this,this.constructor.name,value);
	}

	changeDutyCycle(args) {
		// change the duty cycle to value, using stepSize and delay

		var value	= args && args.value	? args.value	: args;
		var	stepSize= args && args.stepSize	? args.stepSize	: 0.01;
		var	delay	= args && args.delay	? args.delay	: 150;
		
		if (isMissing(stepSize)) stepSize=0.002;
		if (isMissing(delay)) delay = 150;
		if		(this.extraBound>this.lowerBound && value < this.extraBound) value=this.lowerBound;
		else if (value<this.lowerBound) value=this.lowerBound;
		else if (value>this.upperBound) value=this.upperBound;
		var oldValue=this.dutyCycle;
		if (value<oldValue) stepSize= -stepSize;
		var nrSteps=Math.ceil((value-oldValue)/stepSize);
		var that=this;
		for (let s = 1;s<= nrSteps;s++) {
			let val= (s==nrSteps) ? value : (oldValue+stepSize*s);
			setTimeout(function() {
				let duty=Math.round(val*that.pwmRange);
				if (Logger.level>=2) Logger.log("PWDevice     ["+that.gpios[0]+"]  setDuty "+val+" ("+duty+") "+new Date().getTime());
				if (that.pwmType=="hard")	that.dev.write(val);
				else 						that.dev.pwmWrite(duty);
			},delay*s);
		}
		this.dutyCycle=value;
		if (this.watcher) this.watcher(0,this,this.constructor.name,value);
	}

	clear() {
		this.dev.clear_channel(this.dma,this.gpios[0]);
	}
	
	getValue() {
		return this.dutyCycle;
	}
	getDutyCycle() {
		return this.dutyCycle;
	}
	
	onChanged(watcher) {
		// define a method to be called whenever the signal changes
		this.watcher=watcher;
	}
	
	release() {
		Logger.info("PWDevice     releasing "+this.toString());
		if (!this.emulate && this.pwmType!="hard") {
			require("pigpio").terminate();
		}
	}
}

PWDevice.schema = {
	properties: {
		range:		{ type: "array", items: [ {type: "number"}, {type: "number"} ], default:[0,1] },
		duty:		{ type: "array", items: [ {type: "number"}, {type: "number"} ], default:0 },
		frequency:	{ type: "number", description: "in Hz", default: 50},
		drives:		{ tpye: "string", description: "id of element connected to the PWM port", },
	}
}

PWDevice.getApiDescription = function() {
	return [
		{	cmd:"getDutyCycle",
			effect:"returns the duty cycle (0..1)"
		},
		{	cmd:"getValue",
			effect:"returns the duty cycle (0..1)"
		},
		{	cmd:"setDutyCycle",
			args:[
				{name:"value",	meaning:"a fractional number between 0 and 1"},
			],
			effect:"updates the duty cycle (0..1)"
		},
		{	cmd:"changeDutyCycle",
			args:[
				{name:"value",		meaning:"a fractional number between 0 and 1"		},
				{name:"stepSize",	meaning:"size of increment", default:0.002			},
				{name:"delay",		meaning:"delay after each step in msec", default:150},
			],
			effect:"updates the duty cycle (0..1) with a given rate of change"
		},
	];
}

module.exports.PWDevice = PWDevice;
