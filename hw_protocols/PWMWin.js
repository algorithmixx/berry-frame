"use strict";

const	Logger 		= require("../utils/Logger.js").Logger;

// =========================================================================================================

class PWMWin {
	// a Windows Stub for pulse width modulation

	constructor(config) {
		this.gpio=18;
		this.frequency=50;
		this.period=20;
		this.dutyCycle=0;
		if (config) {
			if(config.gpio) 	this.gpio		=	config.gpio;
			if(config.pin ) 	this.gpio		+= 	(":"+config.pin);
			if(config.freq) 	this.frequency	=	config.frequency;
			if(config.period)	this.period		=	config.period / 1000;
		}
	}

	write(dutyCycle) {
		Logger.log("PWMWin       ["+this.gpio+"]  "+Math.round(1000*dutyCycle)/this.frequency+" msec   , period="+this.period+" msec");
		this.dutyCycle=dutyCycle;
	}
	
	add_channel_pulse(dma,gpio,from,duration) {
		Logger.log("PWMWin       ["+this.gpio+"]  "+(duration/1000)+" msec   , period="+(1000/this.frequency)+" msec");
	}
	
	clear() {
		Logger.log("PWMWin       ["+this.gpio+"]  clear");
		this.dutyCycle=0;
	}
	
}

module.exports.PWMWin = PWMWin;