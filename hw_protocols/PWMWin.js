"use strict";

// =========================================================================================================

class PWMWin {
	// a Windows Stub for pulse width modulation

	constructor(config) {
		this.gpio=18;
		this.frequency=50;
		this.dutyCycle=0;
		if (config) {
			if(config.pin ) this.gpio=config.pin;
			if(config.freq) this.frequency=config.frequency;
		}
		else if (gpio) this.gpio=config;
	}

	write(dutyCycle) {
		this.dutyCycle=dutyCycle;
	}
	
}

module.exports.PWMWin = PWMWin;