"use strict";

const fs			= require('fs');

// const Logger 		= require("../utils/Logger.js").Logger;

// =========================================================================================================

class BerryFrame {
	/*
		A framework for controlling one or more Raspberry Computers with attached devices 
		like buttons, LEDs, LED strips, motion sensors, servos via the web.

		author: Dr. Gero Scholz, Oct 2019
		license: GPL
		see also the wiki under: http://followthescore.org/itcanbefun
		contact gero.scholz@gmail.com  to ask for access
	*/
	
	constructor() {
		// get current script name

		this.scriptName	 = process.argv[1].replace(/.*[/\\]/,'').replace(/[.]js$/,'');
		this.versionId	 = "1.0.0";
	}	

	load() {
		this.cmdLine = this.parseArgs();
		console.log("BerryFrame: This is a test program without any functionality.");
		console.log("cmdLine:",cmdLine);
	}
	
	
	parseArgs() {
		// parse command line arguments; return { argv:[], options:{} }
		
		var getopt = 
			require('node-getopt').create([
				['h' , 'help',					'display this help'														],
				['a' , 'api',					'display syntax help on the API of all supported hardware element types'],

				['n' , 'name=',					'server name for identification, default: appType'						],
				['p' , 'port=',					'port number, default: depending on appType (8080..8090)'				],
				['m' , 'master=localhost:9000',	'register at Master server, default:localhost:9000'						],
				['r' , 'revision=',				'use a specific hardware revision, default:current/latest revison'		],

				['c' , 'cmd=',					'initial command(s) to be excuted'										],
				
				['l' , 'logLevel=0',			'level of logging (on stdout)'											],
				['e' , 'emulate',				'emulate the devices, default:true on Windows, false on Raspberry'		],
				['x' , 'exclude=none',			'client functions to exclude (rs,rb,U,R,S,X,all,none), default: none'	],
				
			])
			.bindHelp()
			.setHelp('\n'
					+'Purpose:\n'
					+'  Start a Raspberry Pi application (a "Berry") with attached devices and create a socket server\n'
					+'  which allows to control the application via a generic browser interface.\n'
					+'  If this program is called under Windows (or with option "-e" it will emulate the hardware.\n'
					+'  The program requires as an argument the name of a hardware configuration file.\n'
					+'  The special built-in name "Master" will create a registration service for all other Berries.\n'
					+'\n'
			)
			.parseSystem()
		;

		// if there are no arguments at all or if appType is missing: show help
		if (getopt.argv.length<=0) { 
			console.log(getopt.getHelp());
			process.exit(0);
		}
		
		var appTypeName = getopt.argv[0];
		
		// if port is missing: use default port of appType
		if (isMissing(getopt.options["port"])) {
			getopt.options["port"] = this.appTypes[appTypeName].port;
		}
		
		// if server name is missing: use appTypeName
		if (isMissing(getopt.options["name"])) {
			getopt.options["name"] = appTypeName;
		}
		
		// assign default values according to definitions
		for (var arg in getopt.long_options) {
			if (isMissing(getopt.options[arg]) && getopt.long_options[arg].definition.indexOf('=')>0) {
				getopt.options[arg]=getopt.long_options[arg].definition.replace(/.*?=/,'');
			}
		}
		
		// change numeric option values to numbers
		for (var arg in getopt.options) {
			if (getopt.options[arg]!="" && !isNaN(getopt.options[arg])) getopt.options[arg]= + getopt.options[arg];
		}

		// create an instance member for each option (with its long name)
		for (var arg in getopt.options) {
			if (isPresent(getopt.long_options[arg])) this[arg]=getopt.options[arg];
		}
		
		return getopt;
	}

	
}

// =========================================================================================================

exports.BerryFrame = BerryFrame;