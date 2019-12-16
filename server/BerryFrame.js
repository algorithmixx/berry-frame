"use strict";

const fs			= require('fs');

const Logger 		= require("../utils/Logger.js").Logger;
const isMissing 	= require("../utils/Logger.js").isMissing;
const isPresent 	= require("../utils/Logger.js").isPresent;

const theServer 	= require("../server/Server.js").theServer;			// singleton instance
const theHardware	= require("../hw_control/Hardware.js").theHardware;	// singleton instance
const SystemInfo	= require("systeminformation");

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
		this.versionId	 = "1.2.4";
		
		// find known Berry types and their default properties (description, port, rev, ..)
		this.berryTypes = this.findBerryTypes();
				
		// parse command line arguments, create an instance var for each option
		this.cmdLine = this.parseArgs();

		if (this.cmdLine==null) {
			this.checkInstallation();
			return;
		}
				
		// select the desired berry type
		this.berryType = this.berryTypes[this.cmdLine.argv[0]];
		
		// intro message
		Logger.info("BerryFrame   "+this.berryType.name+" -- "+JSON.stringify(this.cmdLine.argv)+" -- "+JSON.stringify(this.cmdLine.options));

		// Operating system info
		this.os = process.platform;
		SystemInfo.system(function(data) {
			if (data.manufacturer=="Raspi") this.os="raspi";
			Logger.info("BerryFrame   SYSTEM = "+JSON.stringify(data));			
		});
		
		// set logging level
		Logger.level= this.logLevel;
	}
	
	findBerryTypes() {
		// collect information from Berry hardware description files (*.hwd)

		var berryTypes={};

		// look for berries in direct subdirectories of the pwd
		var my=this;	
		fs.readdirSync("./").forEach(hwd => {
			if (hwd=="berry") return;
			if (hwd=="zip") return;
			if (!fs.lstatSync("./"+hwd).isDirectory()) return;
			try { if (!fs.existsSync("./"+hwd+"/server")) return; } catch(e) {}
			theHardware.loadDescription(hwd,hwd,"",false,true);
			berryTypes[hwd]={name:hwd,port:theHardware.port,title:theHardware.title,desc:theHardware.desc,rev:theHardware.rev};
		});

		
		// and add the "Master" berry type
		theHardware.loadDescription("Master","Master","",false,true);
		berryTypes.Master={name:"Master",port:theHardware.port,title:theHardware.title,desc:theHardware.desc,rev:theHardware.rev};

		return berryTypes;
	}
	
	parseArgs() {
		// parse command line arguments; return { argv:[], options:{} }
		
		var berryHelp = "";
		for (var berryTypeName in this.berryTypes) {
			var berryType=this.berryTypes[berryTypeName];
			berryHelp
				+="    "+berryTypeName.padEnd(12)
				+ " "+berryType.rev.padEnd(8)
				+ " ["+berryType.port+"]  "
				+ berryType.title
					.replace(/\<br\/?\>/g,"\n                                  ")
					.replace(/\<.*?\>/g,"")
					.replace(/&[a-zA-z]{2,5};/g,"")
					+"\n"
			;
		}
		var getopt = 
			require('node-getopt').create([
				['h' , 'help',					'display this help'														],
				['v' , 'version',				'display version ID'													],
				['a' , 'api',					'display syntax help on the API of all supported hardware element types'],

				['i' , 'install=',				'install a berry from the berry-shop, expects the name as an argument'	],
				['z' , 'zip',					'zip the current berryType into ./zip/berryType.zip'						],
				['b' , 'browse',				'open site in local default browser after server has started'			],

				['n' , 'name=',					'server name for identification, default: berryType'					],
				['p' , 'port=',					'port number, default: depending on berryType (8080..8090)'				],
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
					+'  Start a Raspberry Pi application (a "berry") with attached devices and create a socket server\n'
					+'  which allows to control the berry via a generic browser interface.\n'
					+'  If this program is called under Windows (or with option "-e") it will emulate the hardware.\n'
					+'  The program requires as an argument the name of a hardware configuration file.\n'
					+'  The special built-in name "Master" will create a registration service for all other Berries.\n'
					+'\n'
					+'Version:    '+this.versionId+'\n'
					+'\n'
					+'Usage:\n  berry  [Options..]  <berryType>\n'
					+'\nOptions:\n[[OPTIONS]]\n'
					+'\n'
					+'Available Berries:\n'+berryHelp
					+'\n'
					+'More Berries:\n'+'    see https://followthescore.org/berry/index.html\n'
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
			)
			.parseSystem()
		;

		// show API help and exit
		if (isPresent(getopt.options["a"])) { 
			Logger.info(JSON.stringify(theHardware.apiHelp(getopt.argv[0]),null,4));
			return null;
		}
		
		// show versionId and exit
		if (isPresent(getopt.options["v"])) { 
			Logger.info("berry-frame: version "+this.versionId);
			return null;
		}

		if (isPresent(getopt.options["i"])) {
			this.installBerry(getopt.options["i"]);
			return null;
		}
		
		// if there are no arguments at all or if berryType is missing: show help and exit
		if (getopt.argv.length<=0) { 
			Logger.info(getopt.getHelp());
			Logger.error('"berryType" required.');
			return null;
		}

		if (getopt.options["zip"] && getopt.argv[0]) {
			var arg = getopt.argv[0];
			var berries= (arg=="all") ? Object.keys(this.berryTypes) : [arg];
			var berriesCount = berries.length;
			for(let berry of berries) {
				if (berry=="Master") continue;
				this.zipBerry(berry,function() {
					berriesCount--;
					if (arg=="all" && berriesCount<=1 || arg!="all" && berriesCount<=0) process.exit(0);
				});
			}
			return null;
		}

		var berryTypeName = getopt.argv[0];
		
		// check if berryType is known
		if (!this.berryTypes[berryTypeName]) {
			Logger.error("Berry        unknown berryType: "+berryTypeName);
			return null;
		}
		
		// if port is missing: use default port of berryType
		if (isMissing(getopt.options["port"])) {
			getopt.options["port"] = this.berryTypes[berryTypeName].port;
		}
		
		// if server name is missing: use berryTypeName
		if (isMissing(getopt.options["name"])) {
			getopt.options["name"] = berryTypeName;
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

		if (this.cmdLine==null) {
			return;
		}
		
		// set default configuration
		if (!theHardware.loadDescription(this.berryType.name,this.name,this.revision,this.emulate,false)) return;

		// "build" the hardware
		if (!theHardware.build(this.name,this.versionId)) return;
		
		// create http server and loop forever
		theServer.configure(
			this.berryTypes,
			this.berryType,
			this.name,
			this.revision,
			this.port,
			this.master,
			this.cmdLine.options['exclude'],
			this.cmdLine.options['browse'],
			
		);
		theServer.start(this.cmd);
		return;	// we never arrive here
	}
	
	async installBerry(berry) {
		// assume that berry is the name of a berry in the berry-shop
		// ATTENTION: this function will terminate the current process.
		
		if (berry.charAt(0)==".") return;

		const fs = require('fs');

		// do not clobber existing berry
		if (fs.existsSync("./"+berry)) {
			Logger.error("BerryFrame   cannot download berry '"+berry+"'. Local directory already exists");
			process.exit(0);
		}

		var url = "https://followthescore.org/berry/zip/"+berry+".zip";
		Logger.info("BerryFrame   downloading from berry-shop: "+berry);
		
		try {
			// make zip directory
			if (!fs.existsSync("./zip")) fs.mkdirSync("zip");
			var zipFile = "./zip/"+berry+".zip"; 
			// remove current zip (if existing)
			if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile); 
			// download and unzip
			this.download(url,zipFile,function() {
				Logger.info("BerryFrame   downloaded "+zipFile);
				if (process.platform=="win32") {
					const Zip = require('node-7z-forall');
					var archive = new Zip();
					archive.extractFull(zipFile,".").then(function() { 
						Logger.info("BerryFrame   unzipped "+zipFile);		
					});
				}
				else {
					Logger.info("BerryFrame   unzipping "+zipFile);		
					var childProc = require('child_process'); 
					childProc.spawnSync('unzip',[zipFile,"-d","."], {stdio:"inherit"});
					Logger.info("BerryFrame   unzipped "+zipFile);	
					process.exit(0);
				}
			});
		}
		catch(e) {
			Logger.error("cannot download and install "+url,e);
			process.exit(0);
		}
	}
	
	download(url, dest, cb) {
		const https = require("https");
		var file = fs.createWriteStream(dest);
		console.log("requesting "+dest+" from "+url);
		var request = https.get(url, function(response) {
			response.pipe(file);
			file.on('finish', function() {
				file.close(cb);  // close() is async, call cb after close completes.
			});
		})
		.on('error', function(err) { // Handle errors
			fs.unlink(dest); // Delete the file async. (But we don't check the result)
			Logger.error(err.message);
		});
	}
	
	zipBerry(berry,cb) {
		// create a ZIP file for a berry

		const fs = require('fs');

		// make sure directory exists
		if (!fs.existsSync("./"+berry) || !fs.existsSync("./"+berry+"/server")) {
			Logger.error("BerryFrame   cannot zip berry '"+berry+"'. Local directory not found.");
			cb(berry);
			process.exit(1);
			return;
		}


		// make zip directory
		if (!fs.existsSync("./zip")) fs.mkdirSync("zip");
		
		// check if we already have a zip file with a creation date 
		// which is later than the berry directory last modification date

		var zipFile = "./zip/"+berry+".zip";
		if (fs.existsSync(zipFile)) {
			var modified = fs.statSync(zipFile).mtime;
			// under non-windows systems check if the zip archive is up to date; 
			// (win32 modification times of directories are not reliable)
			if (process.platform!="win32" && fs.statSync("./"+berry).mtime < modified) {
				Logger.log("BerryFrame   "+berry+".zip was up to date ("+modified+")");
				cb(berry);
				return;
			}
			// remove current zip file (if existing)
			fs.unlinkSync(zipFile);
		}

		// create zip file

		try {
			if (process.platform=="win32") {
				const Zip = require('node-7z-forall');
				var archive = new Zip();
				archive.add(zipFile,"./"+berry).then(function() { 
					Logger.info("BerryFrame   created "+zipFile);		
					cb(berry);
				});
			}
			else {
				var childProc = require('child_process'); 
				childProc.spawnSync('zip',["-r",zipFile,"./"+berry], {stdio:"inherit"});
				Logger.info("BerryFrame   created "+zipFile);		
				cb(berry);
			}
		}
		catch(e) {
			Logger.error("BerryFrame: could not create "+zipFile,e);
			cb(berry);
		}

	}

	async checkInstallation() {
		// the default installation only loads node_modules which are needed on all platforms
		// on a Raspberry we need additional modules; if they are missing we load them via npm

		if (require('os').platform=="win32") return;
		try {
			const sys = await (require('systeminformation').system());
			if (sys.manufacturer=="Raspberry Pi Foundation") {
				try {
					require("onoff");	// if the module has been installed, everything is fine
					// console.log("berry-frame: running on Raspi, 'onoff' is installed.");
				}
				catch(err) {
					var childProc = require('child_process'); 
					console.log(
						'\n=================================================================================='+
						'\n   BerryFrame:  Installing additional modules for the Raspberry Pi platform'+
						'\n'+
						'\n                Please be patient ...'+
						'\n=================================================================================='+
						'\n'
					);
					try {
						childProc.spawn(
							'npm',
							[
								"install",
								"onoff@^5.0.0",
								"node-aplay@^1.0.3",
								"pi-spi@^1.2.1",
								"raspi-i2c@^6.2.4",
								"raspi-onewire@^1.0.1",
								"raspi-pwm@^6.0.0",
								"speaker@^0.3.1"
							],
							{stdio:"inherit"}
						);
					}
					catch(e) {
						console.log(e);
					}
				}
			}
		}
		catch (err) {
			console.log(err);
		}		
	}
		
}

// =========================================================================================================

exports.BerryFrame = BerryFrame;
