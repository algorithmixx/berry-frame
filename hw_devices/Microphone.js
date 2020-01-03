const Logger 	= require("../utils/Logger.js").Logger;
const isMissing = require("../utils/Logger.js").isMissing;
const isPresent = require("../utils/Logger.js").isPresent;

const Device	= require("./Device.js").Device;

class Microphone extends Device {
	// represents a microphone on a soundcard which is linked via I2S
	// It uses GPIO 20 and has a button on 24 and an LED on 25
	// the speakers on the same card use GPIO 16,18,19,21

	constructor(id,name,emulate) {

		super(id,name,[],emulate);	// do not use "traditional" inout GPIO pins
		this.gpios = [20];	// in fact, the GPIO Pins are configured to use the I2S protocol
		Logger.info("Microphone   creating "+name+" I2S protocol [18?,19?,20] "+(emulate?" (emulation)":""));
		this.direction = "in";
		this.protocol="I2S";
		this.callback=null;
	}

	getValue() {
		return "?";
	}
	
	watch(callback) {
		this.callback=callback;
	}
	
	release() {
	}
}

Microphone.schema = {
	description: "A microphone (mono)",
}

Microphone.getApiDescription = function() {
	return [
		{	cmd:"getValue",
			effect:"returns a frame of the current signal"
		}
	];
}
module.exports = Microphone;
