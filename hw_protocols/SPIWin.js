const Logger 	= require("../utils/Logger.js").Logger;

"use strict";

// =========================================================================================================

class SPIWin {
	// a Windows Stub for the pi-spi module

	constructor(deviceName) {
		this.deviceName = deviceName;
		this.clockSpeed(4e6);
		this.dataMode({ CPHA:0,CPOL:0 });
		this.bitOrder(0);
		Logger.info("SPIWin       using "+deviceName+" (emulation)");
	}

	clockSpeed(speed) {
		if (typeof speed == "undefined") return this.speed;
		this.speed=speed;
	}

	dataMode(mode) {
		if (typeof mode == "undefined") return this.mode;
		this.mode = mode;
	}

	bitOrder(order) {
		if (typeof order == "undefined") return this.order;
		this.order = order;
	}
	
	transfer(outbuffer,incount,cb) {
		Logger.log("____SPIWin    "+this.deviceName+" transfer: "+outbuffer.join(","));
		if (cb) cb();
	}

	read(incount, cb) {
		Logger.log("SPIWin        read .. "+incount);
		if (cb) cb();
	}
	
	write(outbuffer,cb) {
		// Logger.log("SPIWin       write .. "+outbuffer.join(","));
		if (cb) cb(null);
	}

	close(cb) {
		Logger.info("SPIWin        "+this.deviceName+" closed");
		if (cb) cb();
	}
}


// =========================================================================================================

module.exports.SPIWin = SPIWin;
