"use strict";

// =========================================================================================================

// some global functions

function isPresent(obj) { return typeof obj != "undefined"; }
module.exports.isPresent = isPresent;

function isMissing(obj) { return typeof obj == "undefined"; }
module.exports.isMissing = isMissing;

// =========================================================================================================

class Logger {

	// A logging class

	static info (msg) {
		// var time=Logger.time; Logger.time=new Date().getTime(); var elapsed=Logger.time-time;
		console.log(msg /*,elapsed */);
	}
	
	static log(arg1,...args) {
		if (Logger.level<=0) return;
		// var time=Logger.time; Logger.time=new Date().getTime(); var elapsed=Logger.time-time;
		if (args.length>0)	console.log(arg1,args /*,elapsed */ );
		else				console.log(arg1 /* ,elapsed */);
	}
	
	static error(...args) {
		// var time=Logger.time; Logger.time=new Date().getTime(); var elapsed=Logger.time-time;
		console.log("==== ERROR ==== ",args /* ,elapsed */);
	}
}
Logger.level=1;
Logger.time=new Date().getTime();

// =========================================================================================================

module.exports.Logger	 = Logger;
