"use strict";

const fs			= require('fs');

const Logger 		= require("../utils/Logger.js").Logger;
const isMissing 	= require("../utils/Logger.js").isMissing;
const isPresent 	= require("../utils/Logger.js").isPresent;

const theServer 	= require("../server/Server.js").theServer;			// singleton instance
const theHardware	= require("../hw_control/Hardware.js").theHardware;	// singleton instance

// =========================================================================================================

class BerryFrame {
	/*
		A framework for controlling one or more Raspberry Computers with attached devices 
		like buttons, LEDs, LED strips, motion sensors, servos via the web.

		author: Dr. Gero Scholz, Dec 2019
		license: ISL
		contact gero.scholz@gmail.com  to ask for access
	*/
	
	constructor() {
		// get current script name

		this.scriptName	 = process.argv[1].replace(/.*[/\\]/,'').replace(/[.]js$/,'');
		this.versionId	 = "1.0.0";
		
		// find known Berry application types and their default properties (description, port, rev, ..)
		this.appTypes = this.findAppTypes();
				
		// parse command line arguments, create an instance var for each option
		this.cmdLine = this.parseArgs();

		// select the desired application type
		this.appType = this.appTypes[this.cmdLine.argv[0]];
		
		// intro message
		Logger.info("BerryFrame   "+JSON.stringify(this.cmdLine.argv)+" -- "+JSON.stringify(this.cmdLine.options));

		// set logging level
		Logger.level= this.logLevel;
	}
	
	findAppTypes() {
		// collect information from Berry hardware description files (*.hwd)

		var appTypes={};

		// look for applications in direct subdirectories of the pwd
		var my=this;	
		fs.readdirSync("./").forEach(hwd => {
			if (hwd=="berry") return;
			if (hwd=="zip") return;
			if (!fs.lstatSync("./"+hwd).isDirectory()) return;
			try { if (!fs.existsSync("./"+hwd+"/server")) return; } catch(e) {}
			theHardware.loadDescription(hwd,hwd,"",false,true);
			appTypes[hwd]={name:hwd,port:theHardware.port,title:theHardware.title,desc:theHardware.desc,rev:theHardware.rev};
		});

		
		// and add the "Master" app type
		theHardware.loadDescription("Master","Master","",false,true);
		appTypes.Master={name:"Master",port:theHardware.port,title:theHardware.title,desc:theHardware.desc,rev:theHardware.rev};

		return appTypes;
	}
	
	parseArgs() {
		// parse command line arguments; return { argv:[], options:{} }
		
		var appsHelp = "";
		for (var appTypeName in this.appTypes) {
			var appType=this.appTypes[appTypeName];
			appsHelp
				+="    "+appTypeName.padEnd(12)
				+ " "+appType.rev.padEnd(8)
				+ " ["+appType.port+"]  "
				+ appType.title
					.replace(/\<br\/?\>/g,"\n                                  ")
					.replace(/\<.*?\>/g,"")
					.replace(/&[a-zA-z]{2,5};/g,"")
					+"\n"
			;
		}
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
					+'Version:    '+this.versionId+'   --   more info on https://followthescore.org/itcanbefun\n'
					+'\n'
					+'Usage:\n  node server/'+this.scriptName+' [Options..]  <berryType>\n'
					+'\nOptions:\n[[OPTIONS]]\n'
					+'\n'
					+'Available <berryTypes>:\n'+appsHelp
					+'\n'
					+'Notes:\n'
					+'  The program will run forever, acting as a server for http requests and socket connections.\n'
					+'  Typically you will add "&" to the commandline (on Unix) to run it in the background.\n'
					+'  On Windows you can use "start .." to make it execute in the background.\n'
					+'  Log information is written to stdout/stderr and can be redirected to files.\n'
					+'  If you specify initial commands with "-c" you have to use the same syntax as in HWD files.\n'
					+'  multiple commands must be separated by semicolons.\n\n'
					+'API Requests:\n'
					+'  Requests can be made via socket connection or REST-like via http://<berryServer:port>/api/<request>.\n'
					+'  REST requests do not have surrounding braces; member names and data values need not be quoted,\n'
					+'  unnecessary commas are allowed. Example:\n' 
					+'  http://myberryserver:9004/api/id:motionA,cmd:getValue,\n'
					+'  Socket requests must follow standard JSON syntax; they are emitted with the label "action".\n'
			)
			.parseSystem()
		;

		// show API help and exit
		if (isPresent(getopt.options["a"])) { 
			Logger.info(JSON.stringify(theHardware.apiHelp(getopt.argv[0]),null,4));
			process.exit(0);
		}
		
		// if there are no arguments at all or if appType is missing: show help
		if (getopt.argv.length<=0) { 
			Logger.info(getopt.getHelp());
			Logger.error('"appType" required.');
			process.exit(0);
		}
		
		var appTypeName = getopt.argv[0];
		
		// check if appType is known
		if (!this.appTypes[appTypeName]) {
			Logger.error("Berry        unknown appType: "+appTypeName);
			process.exit(-1);
		}
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
	
	load() {
		// create devices and start processing
		
		// set default configuration
		if (!theHardware.loadDescription(this.appType.name,this.name,this.revision,this.emulate)) return;

		// "build" the hardware
		if (!theHardware.build(this.name,this.versionId)) return;
		
		// create http server and loop forever
		theServer.configure(this.appTypes,this.appType,this.name,this.revision,this.port,this.master,this.cmdLine.options['exclude']);
		theServer.start(this.cmd);
		return;	// we never arrive here
	}
	
}

// =========================================================================================================

exports.BerryFrame = BerryFrame;