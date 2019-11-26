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
		
		if (this.emulate) {
			this.dev = new (require('../hw_protocols/PWMWin.js').PWMWin)({pin:pwmPin,frequency:frequency|50});
		}
		else if (this.pwmType=="hard") {
			this.dev = new (require("raspi-pwm").PWM)({pin:pwmPin,frequency:frequency|50});
		}	
		else {
			this.dev = new (require("raspi-soft-pwm").SoftPWM)({pin:pwmPin,frequency:frequency|50});
		}	
		this.direction	= "out";
		this.watcher	= null;
		this.lowerBound = 0;
		this.upperBound = 1;
		this.extraBound = 0;
	}

	limitDutyCycle(bounds) {
		this.lowerBound=bounds[0];
		this.upperBound=bounds[1];	
		this.extraBound=(bounds.length==3) ? bounds[2] : this.lowerBound;
		Logger.log("PWDevice     limits: "+this.lowerBound+"..."+this.upperBound+"  ("+this.extraBound+")");
	}
	
	setDutyCycle(value) {
		// change the duty cycle
		if		(this.extraBound>this.lowerBound && value < this.extraBound) value=this.lowerBound;
		else if (value<this.lowerBound) value=this.lowerBound;
		else if (value>this.upperBound) value=this.upperBound;
		this.dev.write(value);
		if (this.watcher) this.watcher(0,this,this.constructor.name,value);
	}

	getValue() {
		return this.dev.dutyCycle;
	}
	getDutyCycle() {
		return this.dev.dutyCycle;
	}
	
	onChanged(watcher) {
		// define a method to be called whenever the signal changes
		this.watcher=watcher;
	}
	
	release() {
		Logger.info("PWDevice     releasing "+this.toString());
		// ? 
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
	];
}

module.exports.PWDevice = PWDevice;