const Logger 	= require("../utils/Logger.js").Logger;

"use strict";

// =========================================================================================================

class I2CWin {
	// a Windows Stub for the pi-i2c module

	constructor() {
	}

	readByteSync(addr, reg) {
		return 42;
	}

	readWordSync(addr, reg) {
		return Math.round(Math.random()* 32000);
	}
	
	readSync(addr,reg,len) {
		var bytes=[];
		while(len--) bytes.push(24);
		return bytes;
	}
	
	writeSync(addr,reg,buffer) {
		var buf = (typeof buffer == "undefined") ? reg : buffer;
		if(Logger.level>=2) Logger.log("I2CWin       write ["+addr+"] "+reg + " : "+JSON.stringify(buf));
		return this;
	}

	writeByteSync(addr, reg, byteVal) {
		var val = (typeof byteVal=="undefined") ? reg : byteVal;
		if(Logger.level>=2) Logger.log("I2CWin       write ["+addr+"] "+reg + " : "+val);
		return this;
	}

	writeWordSync(addr, reg, wordVal) {
		var val = (typeof wordVal=="undefined") ? reg : wordVal;
		if(Logger.level>=2) Logger.log("I2CWin       write ["+addr+"] "+reg + " : "+val);
		return this;
	}
	
	write(addr,reg,buffer) {
		var buf = (typeof buffer == "undefined") ? reg : buffer;
		if(Logger.level>=2) Logger.log("I2CWin       write ["+addr+"] "+reg + " : "+JSON.stringify(buf));
		return this;		
	}
}


// =========================================================================================================

module.exports.I2CWin = I2CWin;
