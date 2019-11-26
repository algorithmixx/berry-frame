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
		return 25642;
	}
	
	readSync(addr,reg,len) {
		var bytes=[];
		while(len--) bytes.push(24);
		return bytes;
	}

	writeByteSync(addr, reg, byteVal) {
		Logger.log("I2CWin       write @addr : "+reg + " : "+byteVal);
		return this;
	}
}


// =========================================================================================================

module.exports.I2CWin = I2CWin;
