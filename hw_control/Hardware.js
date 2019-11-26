"use strict";

const Logger 	= require("../utils/Logger.js").Logger;
const isMissing = require("../utils/Logger.js").isMissing;
const isPresent = require("../utils/Logger.js").isPresent;
const App 		= require("../server/App.js").App;
const Api 		= require("../server/App.js").Api;
const LED 		= require("../hw_devices/Device.js").LED;
const Button	= require("../hw_devices/Device.js").Button;
const TextInput	= require("../hw_devices/Device.js").TextInput;
const Display	= require("../hw_devices/Device.js").Display;
const PWDevice	= require("../hw_devices/PWDevice.js").PWDevice;
const WS2801	= require("../hw_devices/WS2801.js");
const MPU6500	= require("../hw_devices/MPU6500.js");
const Speakers	= require("../hw_devices/Speakers.js");
const Microphone= require("../hw_devices/Microphone.js");
const DS1820	= require("../hw_devices/DS1820.js").DS1820;

// =========================================================================================================

class Hardware {
	// 	represents a group of virtual building blocks (elements) which are connected to devices
	/*	
		hardware description files have the extension ".hwd"
	
		They use a slightly extended JSON syntax:
		* both types of comments are allowed
		* element names must not be enclosed in quotes
		* superfluous commas are allowed and will be ignored
		* strings can be broken into multiple lines with an optional "+" sign as the last char of a line

		see readme.html for more details.

	*/
	constructor() {
	
		// gpio functionality
		this.pins=["",
			"+3V3",							"+5V",							//  2
			"GPIO_2 I2C1:SDA",				"+5V",							//  4
			"GPIO_3 I2C1:SCL",				"GND",							//  6
			"GPIO_4 1-Wire",				"GPIO_14 UART0:TXD",			//  8
			"GND",							"GPIO_15 UART0:RXD",			// 10
			"GPIO_17",						"GPIO_18 PW0 I2S:CLK",			// 12
			"GPIO_27",						"GND",							// 14
			"GPIO_22",						"GPIO_23",						// 16
			"+3V3",							"GPIO_24",						// 18
			"GPIO_10 SPI0:MOSI",			"GND",							// 20
			"GPIO_9 SPI0:MISO",				"GPIO_25",						// 22
			"GPIO_11 SPI0:CLK",				"GPIO_8 SPI0:CE0",				// 24
			"GND",							"GPIO_7 SPI0:CE1",				// 26
			"EEPROM I2C:SDA",				"EEPROM I2C:SCL",				// 28
			"GPIO_5",						"GND",							// 30
			"GPIO_6",						"GPIO_12 PW0",					// 32
			"GPIO_13 PW1",					"GND",							// 34
			"GPIO_19 PW1 SPI1:MISO I2S:WS",	"GPIO_16 SPI1:CE0",				// 36
			"GPIO_26",						"GPIO_20 SPI1:MOSI I2S:DIN",	// 38
			"GND",							"GPIO_21 SPI1:CLK I2S:DOUT",	// 40		
		];

		// gpio number to pin number
		this.gpioPins=[
			0,0,3,5,7,29,31,26,24,21,19,23,32,33,8,10,36,11,12,35,38,40,15,16,18,22,37,13
		];
		this.pinGpios=[
			 0,
			 0, 0, 2, 0, 3, 0, 4,14, 0,15,
			17,18,27, 0,22,23, 0,24,10, 0,
			 9,25,11, 8, 0, 7, 0, 0, 5, 0,
			 6,12,13, 0,19,16,26,20, 0,21,
		];
		
		this.appObject = null;		// application instance
		
	}
	
	loadDescription(type,name,rev,emulate,silent) {
		// load a textual description of the MCU (micro controller unit) and its peripherals to configure the hardware
		// if a specific rev(ision) is given: search for a sub directory with that name

		if (!silent) Logger.info("Hardware     loading description: '"+type+".hwd"+"', name="+name+", "+(rev=="" ? "latest revision":"rev."+rev));

		try {
			this.type = type;
			var path= type=="Master" ? __dirname+"/../Master/" : "./"+type+"/"+(rev==""?"":rev+"/");
			var fs 	= require('fs');	// filesystem module
			var data = fs.readFileSync(path+"server/"+type+".hwd",'utf8');
			this.parseDescription(name,data);

			// if there is no hardware or if intentional emulation was requested: emulate the hardware
			// emulation will activate logging by default
			
			if (process.platform === "win32" || emulate) {
				this.setAll("emulate",true);
				this.setAll("log",1);
			}
						
			// load the specific application class
			// Such a class will typically register some methods at the device classes.
			// its (single) instance can be accessed by target:"app" in a harware description file
			if (this.appClass!="") {
				this.appObject = new (require(process.cwd()+"/"+type+"/server/"+type+".js")[this.appClass])(this,true,silent);
			}
			else {
				this.appObject=null;
			}
			
			return true;
		}
		catch(err) {
			Logger.error("could not load hardware description: "+type+".hwd",err);
			return false;
		}
	}
	
	parseDescription(name,configText) {
		// create a map of elements from a textual representation of the hardware configuration

		this.name  = name;
		
		var plainConfigText = configText
			.replace(/\s\/\/.*?\r?\n/g,'\n')									// remove comments
			.replace(/\/\*[\s\S]*?\*\//g,'')										// remove comments
			.replace(/([\n\{,]\s*)([a-zA-Z][a-zA-Z_0-9]*) *:/g,'$1"$2":')		// embrace attribute names with quotes
			.replace(/,\s*([\}\]])/g,"$1")										// remove superfluous comma
			.replace(/"\+?\r?\n\s*"/g,"")										// concatenate multi-line strings
		;
		
		//Logger.info(plainConfigText);
		try {
			var config = JSON.parse(plainConfigText);
			
			for (var atr in config) {
				if (atr=="elms") continue;
				this[atr]=config[atr];
			}
			this.elms={};		
			for (var elm of config.elms) {
				this.elms[elm.id]=elm;
			}
		}
		catch(e) {
			Logger.error(e);
			var pos=parseInt(e.message.substr(e.message.indexOf("at position")+11,6));
			if (pos>10) pos-=10; else pos=0;
			Logger.info("JSON input at pos "+pos+" was:"+plainConfigText.substr(pos,50));
		}
	}

	set(elmId,attr,value) {
		// set an element´s attribute to a certain value
		if (!isPresent(this.elms[elmId])) {
			Logger.error("Hardware: unknown element '"+elmId+"'");
			return;
		}
		this.elms[elmId][attr]=value;
	}
	
	setAll(attr,value) {
		// set a given attribute to a given value for all devices
		for (var elmId in this.elms) {
			this.set(elmId,attr,value);
		}
	}
	
	exclude(options) {
		this.exclude=options;
	}
	
	getDeviceAtGpio(gpio,direction) {
		// deliver the device at the given gpio (or null)
		for (var elmId in this.elms) {
			var elm=this.elms[elmId];
			if (elm.gpio==gpio && elm.dev.direction==direction) return elm.dev;
		}
		return null;
	}

	build(name,version) {
		// walk through the map of devices and create corresponding objects
		// version = software version of the server application

		this.name			= name;
		this.version		= version;
		this.creationTime	= new Date().getTime();
		
		for (var elmId in this.elms) {
			var elm=this.elms[elmId];

			Logger.info("Hardware     creating "+elm.type+": "+elm.id+"  ("+elm.name+") "+(elm.emulate?" (emulation)":""));

			if (isMissing(elm.style))   elm.style	= "";
			if (isMissing(elm.log)	)   elm.log	    = 0;
			if (isMissing(elm.emulate)) elm.emulate = false;
			
			if		(elm.type=="LED") {
				// create a led
				elm.dev=new LED(
					elm.id,
					elm.name,
					elm.color || "red",
					elm.gpio,
					elm.emulate
				);
			}
			else if	(elm.type=="PWDevice") {
				// create a pulse width modulated device
				elm.dev = new PWDevice(
					elm.id,
					elm.name,
					elm.gpio,
					elm.frequency ? elm.frequency : 0,
					elm.emulate
				);
				if (elm.duty) elm.dev.limitDutyCycle(elm.duty);
			}
			else if	(elm.type=="Display") {
				// create a character display
				elm.dev = new Display(
					elm.id,
					elm.name,
					elm.xDim?elm.xDim:40,
					elm.yDim?elm.yDim:4,
					elm.emulate
				);
			}
			else if	(elm.type=="TextInput") {
				// create a text input element
				elm.dev = new TextInput(
					elm.id,
					elm.name,
					elm.cols?elm.cols:20,
					elm.rows?elm.rows:1,
					elm.emulate
				);
			}
			else if (elm.type=="Button") {
				// create a Button
				elm.dev = new Button(
					elm.id,
					elm.name,
					elm.gpio,
					elm.debounce ? elm.debounce : 0,
					(elm.downUp || elm.down || elm.up) ? "both":"rising",
					elm.emulate
				);
				if (isPresent(elm.pressed)) {
					Logger.info("Hardware     installing onPressed watcher for "+elm.id);
					elm.dev.onPressed(this.onButtonPressed,true);
				}
				if (isPresent(elm.downUp) || isPresent(elm.down) || isPresent(elm.up)  ) {
					Logger.info("Hardware     installing onDownUp watcher for "+elm.id);
					elm.dev.onChanged(this.onButtonDownUp,true);
				}
			}
			else if (elm.type=="WS2801") {		
				// create led strip
				elm.dev = new WS2801 (
					elm.id,
					elm.name,
					elm.numLEDs,
					elm.emulate
				);
				elm.dev.connect("/dev/spidev"+elm.spi,elm.speed);
				
				if (elm.reverse) elm.dev.reverse(); 
			}
			else if (elm.type=="MPU6500") {		
				// create motion sensor
				elm.dev = new MPU6500 (
					elm.id,
					elm.name,
					elm.image3d,
					elm.emulate
				);
				elm.dev.connect();
			}
			else if (elm.type=="Speakers") {		
				// create speakers
				elm.dev = new Speakers (
					elm.id,
					elm.name,
					this.type,
					elm.emulate
				);
			}
			else if (elm.type=="Microphone") {		
				// create microphone
				elm.dev = new Microphone (
					elm.id,
					elm.name,
					elm.emulate
				);
			}
			else if (elm.type=="DS1820") {		
				// create temperature sensor (1-wire)
				var monitor={};
				if (elm.monitor) {
					if (elm.monitor.display) {
						var target= this.elms[elm.monitor.display];
						monitor.func = target.dev.setValue.bind(target.dev);
						monitor.interval=elm.monitor.interval;
					}
				}
				var below={};
				if (elm.below) {
					below.value=elm.below.value;
					var target= this.elms[elm.below.elm];
					below.func= target.dev[elm.below.cmd].bind(target.dev);
				}
				var between={};
				if (elm.between) {
					between.value=elm.between.value;
					var target= this.elms[elm.between.elm];
					between.func= target.dev[elm.between.cmd].bind(target.dev);
				}
				var above={};
				if (elm.above) {
					above.value=elm.above.value;
					var target= this.elms[elm.above.elm];
					above.func= target.dev[elm.above.cmd].bind(target.dev);
				}
				elm.dev = new DS1820 (
					elm.id,
					elm.name,
					elm.gpio,
					elm.addresse,
					monitor,
					below,
					between,
					above,
					elm.emulate
				);
			}
			else if (elm.type=="Label" || elm.type=="FrontPanel" || elm.type=="Action") {
				; // do nothing
			}
			else {		
				// unknown element type
				Logger.error("Hardware: unknown device type "+elm.type);
			}
		}
		
		// if we have a "circle" hardware: place the seven buttons and their associated leds in a circle
		if (this.type.indexOf("Circle")==0) {
			// count number of LEDs
			var size=0;
			for (var id in this.elms) if (this.elms[id].type=="LED") size++;
			var d=300;
			for (var n=0;n<size;n++) {
				var pos=(n+0.5)*2*Math.PI/size;
				var xb = d/2-20+Math.round(Math.sin(pos)*0.38*d);
				var yb = d/2-15-Math.round(Math.cos(pos)*0.38*d);
				this.elms["B"+n].style+="left:"+xb+"px;top:"+yb+"px";
				var xl = d/2-20+Math.round(0.72*Math.sin(pos)*0.3*d);
				var yl = d/2-20-Math.round(0.72*Math.cos(pos)*0.3*d);
				this.elms["L"+n].style+="left:"+xl+"px;top:"+yl+"px";
			}
		}
		
		// now we have instantiated all hardware elements
		// initialize the application;
		if (this.appObject) this.appObject.init();
		
		return true;		
	}

	release() {
		// free resources 

		for(var elmId in this.elms) {
			var elm=this.elms[elmId];
			if (elm.type=="WS2801" || elm.type=="MPU6500") {
				elm.dev.disconnect(function() { console.info("Hardware     "+elm.type+":"+elm.name+" disconnected."); });
			}
			else if (elm.type=="Label") {
			}
			else if (elm.dev) {
				elm.dev.release();
				Logger.info("Hardware     "+elm.type+":"+elm.name+" released.");
			}
		}
	}
	
	onButtonPressed(rc,button,type,value) {
		// toggle the outputs linked to a button

		var but = theHardware.elms[button.id];
		Logger.log("Hardware     "+button.id+" pressed, elm(s): "+JSON.stringify(but.pressed.elm)+", cmd: "+but.pressed.cmd);
		var elms= (typeof but.pressed.elm == "string") ? [but.pressed.elm] : but.pressed.elm;
		for (var target of elms) {
			if 		(target=="app" && theHardware.appObject) theHardware.appObject[but.pressed.cmd](but);
			else theHardware.elms[target].dev[but.pressed.cmd](but);
		}
	}
	
	onButtonDownUp(rc,button,type,value) {
		// activates the outputs linked to a button while it is pushed

		var but = theHardware.elms[button.id];
		var elm = theHardware.elms[button.id];
		var elms=[];
		var cmd="?";
		if (value==1 && isPresent(elm.down)) {
			cmd=but.down.cmd;
			elms= (typeof but.down.elm == "string") ? [but.down.elm] : but.down.elm;
		}
		else if (value==0 && isPresent(elm.up)) {
			cmd=but.up.cmd;
			elms= (typeof but.up.elm == "string") ? [but.up.elm] : but.up.elm;
		}
		else if (isPresent(elm.downUp)) {
			cmd=but.downUp.cmd;
			elms= (typeof but.downUp.elm == "string") ? [but.downUp.elm] : but.downUp.elm;
		}

		Logger.log("Hardware     "+button.id+" "+value+", elm(s): "+JSON.stringify(elms)+", cmd: "+cmd);
		
		for (var target of elms) {
			if 		(target=="app" && theHardware.appObject) theHardware.appObject[cmd](but,value);
			else theHardware.elms[target].dev[cmd](but,value);
		}
	}
	
	getAllStatesJson() {
		var states=[];
		for (var elm of Object.values(this.elms)) {
			if 		(elm.type=="FrontPanel") {
				;
			}
			else if (elm.type=="Label") {
				;
			}
			else if (elm.type=="WS2801") {
				states.push({id:elm.id,type:elm.type,value:elm.dev.getValue()});
			}
			else if (elm.type=="MPU6500") {
				states.push({id:elm.id,type:elm.type,value:elm.dev.getValue()});
			}
			else if (elm.type=="Action") {
				; // actions have no associated state
			}
			else if (elm.type=="DS1820") {
				states.push({id:elm.id,type:elm.type,value:elm.dev.getValue()});
			}
			else if (elm.dev.direction=="out") {
				states.push({id:elm.id,type:elm.type,value:elm.dev.getValue()});
			}
		}
		return {states:states};
	}
	
	getSetupJson() {
		var hwElms={};
		var gpios = [];
		var pins = [];
		for (var elmId in this.elms) {
			hwElms[elmId]={};
			var elm=this.elms[elmId];
			for (var atr in elm) {
				if (atr=="dev") continue;
				hwElms[elmId][atr]=elm[atr];
				if (isPresent(elm.dev)) {
					if (isPresent(elm.dev.direction)) hwElms[elmId].direction=elm.dev.direction;
					if (isPresent(elm.dev.gpios)	) 	{
						for (var gpio of elm.dev.gpios) {
							var gpioNr = parseInt(gpio);
							gpios[gpioNr]={type:elm.type, name:elm.name, pin:this.gpioPins[gpioNr], signal:this.pins[this.gpioPins[gpioNr]]};
							pins[this.gpioPins[gpioNr]]={type:elm.type, name:elm.name, gpio:gpioNr, signal:this.pins[this.gpioPins[gpioNr]]};
						}
						hwElms[elmId].gpios 	= elm.dev.gpios;
					}
					if (isPresent(elm.dev.protocol)	)	{
						hwElms[elmId].protocol 	= elm.dev.protocol;
					}
				}
			}
			if 		(elm.type=="Button") 	hwElms[elmId].api = Button.getApiDescription();
			else if (elm.type=="Display")	hwElms[elmId].api = Display.getApiDescription();
			else if (elm.type=="TextInput") hwElms[elmId].api = TextInput.getApiDescription();
			else if (elm.type=="LED") 		hwElms[elmId].api = LED.getApiDescription();
			else if (elm.type=="WS2801") 	hwElms[elmId].api = WS2801.getApiDescription();
			else if (elm.type=="Speakers") 	hwElms[elmId].api = Speakers.getApiDescription();
			else if (elm.type=="Microphone")hwElms[elmId].api = Microphone.getApiDescription();
			else if (elm.type=="MPU6500")	hwElms[elmId].api = MPU6500.getApiDescription();
		}
		for (var p=1;p<=40;p++) {
			if (!pins[p]) pins[p]={gpio:this.pinGpios[p],signal:this.pins[p]};
		}
		
		var response={
			setup : {
				title:			this.title,
				type:			this.type,
				name:			this.name,
				desc:			this.desc,
				rev:			this.rev,
				version:		this.version,
				style:			this.style,
				creationTime:	this.creationTime,
				exclude:		this.exclude,
				elms:			hwElms,
			},
			pins:	pins,
			gpios:	gpios,
		};
		if (this.img) response.setup.img = this.img;		
		return response;
	}
	
	apiHelp(type) {
		var help = {
			Syntax:		"Hardware elements are referenced by their id. Depending on the type of the element "+
						"you can use one of the following APIs; to reference the Hardware in general, use 'id:hardware'.",
			Example:	"If a hardware description contains a LED named 'alarm', you could call "+
						"yourBerryServer:port/api?id=alarm,cmd:blink,cycles:3",
			Api:		Api.getApiDescription(),
			Button: 	Button.getApiDescription(),
			TextInput: 	TextInput.getApiDescription(),
			LED:		LED.getApiDescription(),
			Microphone:	Microphone.getApiDescription(),
			MPU6500:	MPU6500.getApiDescription(),
			PWDevice:	PWDevice.getApiDescription(),
			Speakers:	Speakers.getApiDescription(),
			WS2801:		WS2801.getApiDescription(),
			Hardware:	Hardware.getApiDescription(),
			App:		App.getApiDescription(),
		}
		if (type) {
			try {
				const appClass = require("../app/"+type+"/"+type+".js")[type];
				help[type] = appClass.getApiDescription();
			}
			catch(e) {
				; // if we do not have an application class: ignore silently
			}
		}
		return help;
	}
	
}
Hardware.getApiDescription = function() {
	return [
		{	cmd:"getSetup",
			effect:"returns all elements of a hardware description"
		},
		{	cmd:"getState",
			effect:"returns the current state of all elements"
		},
		{	cmd:"getServers",
			effect:"returns a list of the currently active Berry servers"
		},
		{	cmd:"stop",
			effect:"shut down the hardware (and the Berry server"
		},
	];
}
// =========================================================================================================

var theHardware = new Hardware();
module.exports.theHardware = theHardware;

