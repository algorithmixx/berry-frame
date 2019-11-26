"use strict";

const Logger 	= require("../utils/Logger.js").Logger;
const isMissing = require("../utils/Logger.js").isMissing;
const isPresent = require("../utils/Logger.js").isPresent;

// =========================================================================================================

class App {
	/*
		A parent class for application classes
	*/
	
	constructor(hardware,silent) {
		this.hardware	= hardware;
		if(!silent) Logger.info("App          loading: "+this.constructor.name+" "+silent);
	}
	
	setServer(server) {
		this.server=server;
	}
	
	onStart(onStarted) {
		// called immediately before the web server starts regular processing
		// "onstarted" is a list of initial actions which may have been passed by the command line
		// can be overwritten in the specific sub class
		Logger.info("App          started: "+this.constructor.name)
		if (onStarted) onStarted();
	}

	// onActivate(id,state) {
		// should be overwritten in the specific sub class
		//Logger.info("App          Button "+id+" "+state);
	// }
	
	// onPressed(id) {
		// should be overwritten in the specific sub class
		// Logger.info("App          Button "+id+" pressed");
	// }
	
	onStop(onStopped) {
		// called immediately before the web server stops processing
		// can be overwritten in the specific sub class
		Logger.info("App          stopping: "+this.constructor.name);
		if (onStopped) onStopped();
	}

}
App.getApiDescription = function() {
	return [
		{	cmd:	"onStart",
			effect:	"a function which is automatically performed on startup"
		},
		{	cmd:	"onStop",
			effect:	"a function which is automatically performed immediately before shutdown"
		},
		{	cmd:	"onActivate",
			effect:	"a function which receives and handles a push button event ('down' or 'up')",
			args: [
				{name:"id",		meaning:"the id of the button causing the event"},
				{name:"state",	meaning:"the state ('up' or 'down'"},
			]
		},
		{	cmd:	"onPressed",
			effect:	"a function which receives and handles a switch button press event",
			args: [
				{name:"id",		meaning:"the id of the button causing the event"},
			]
		},
		{	cmd:	"...",
			effect:	"... more methods might be defined in the application-specific class for a hardware definition"
		},
	];
}

class Api {	
}
Api.getApiDescription = function() {
	return [
		{	cmd:	"help",
			effect:	"deliver a description of the API interface"
		}
	];
}

// =========================================================================================================
module.exports.App = App;
module.exports.Api = Api;

