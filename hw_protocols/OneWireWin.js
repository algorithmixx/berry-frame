"use strict";

// =========================================================================================================

class OneWireWin {
	// a Windows Stub for pulse width modulation

	constructor(config) {
	}

	searchForDevices(cb) {
		var err;
		cb(err,["28-000004d8801b"]);
	}
	
	read(id,numBytesToRead,cb) {
		var err;
		var buf = Buffer.from("66 01 4b 46 7f ff 0a 10 2d : crc=2d YES\n66 01 4b 46 7f ff 0a 10 2d t=2"
					+Math.round((1000+2000*Math.random()))+"\n\0".substr(0,numBytesToRead));
		cb(err,buf);
	}

	readAllAvailable(id,cb) {
		this.read(id,75,cb);
	}
	
}

module.exports.OneWireWin = OneWireWin;