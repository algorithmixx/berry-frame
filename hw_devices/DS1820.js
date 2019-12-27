const Logger 	= require("../utils/Logger.js").Logger;
const isMissing = require("../utils/Logger.js").isMissing;
const isPresent = require("../utils/Logger.js").isPresent;

const Device	= require("./Device.js").Device;

class DS1820 extends Device {
	/*
		A temperature sensor based on 1-wire protocol
	*/
	
	constructor(id,name,gpio,addresse,below,between,above,emulate) {

		super(id,name,[gpio],emulate);
		
		this.direction		= "in";
		this.watcher		= null;
		this.below			= below;
		this.between		= between;
		this.above			= above;
		
		this.addresse		= addresse;
		this.oneWireId		= addresse;			// the technical id of our sensor on the 1-wire bus
		
		Logger.info("DS1820       connecting to addresse: "+addresse+" , above="+(above.value||"")+", below="+(below.value||""));
		if (this.emulate) {
			this.dev = new (require('../hw_protocols/OneWireWin.js').OneWireWin)();
			this.loadValue(null);
		}
		else {
			this.dev = new (require('raspi-onewire').OneWire)();
			var that=this;
			// search for all devices, identify the current sensor and store its oneWireId
			this.dev.searchForDevices((err,devices) => {
				// class OneWire expects an array of 8 numbers as oneWireId for reading a sensor
				// we retrieve that array from an internal datra structure of OneWire
				for (var busId in that.dev._deviceIdMapping) {
					if (that.dev._deviceIdMapping[busId] == that.addresse) {
						that.oneWireId = busId.split('-');
						break;
					}
				}
				if (that.oneWireId==that.addresse)	Logger.error("DS1820: could not find sensor with addresse "+that.addresse);
				else								Logger.info("DS1820       found oneWireId = "+that.oneWireId);
				that.loadValue(null);
			});
		}		
	}

	loadValue(cb) {
		var that=this;
		this.dev.readAllAvailable(this.oneWireId,function(err,buf) { 
			that.value= parseFloat(( (buf.toString().replace(/^[\s\S]*t=/,'').replace(/[^-0-9]*/g,'')) / 1000. ).toFixed(2));
			Logger.log("DS1820       "+that.addresse+" : received value from 1-wire bus: "+that.value);
			if (that.watcher)		that.watcher(0,that,"DS1820",that.value);
			if (that.above.func) 	that.above.func(that.value>that.above.value ? 1 : 0);
			if (that.between.func) 	that.between.func(that.value>=that.between.value[0] && that.value<=that.between.value[1] ? 1 : 0);
			if (that.below.func) 	that.below.func(that.value<that.below.value ? 1 : 0);
			if (cb && typeof cb=="function") cb(that.value,true);
		});		
	}
		
	getValue(cb) {
		if (cb) this.loadValue(cb);
		else return this.value;
	}
	
	onChanged(watcher) {
		// define a method to be called whenever the signal changes
		this.watcher=watcher;
	}
	
	release() {
	}
}

DS1820.schema = {
	definitions: {
		action: 	Device.action,	// allow additional properties like interval, value
		actions: {
			anyOf: [
				{	$ref: "#/definitions/action"	},
				{	type: "array", items: { $ref: "#/definitions/action" },	},
			]
		}
	},
	properties: {
		addresse:	{ type: "string", description: "unique ID, on the Raspi look at /sys/bus/w1/devices/*" },
		below:	{ 
			$ref: "#/definitions/actions",
			value: { type:"number", description: "threshold in °C" },
		},
		between:	{ 
			$ref: "#/definitions/actions",
			value: { type:"array", description: "thresholds in °C", items: [{type:"number"},{type:"number"}] },
		},
		above:	{ 
			$ref: "#/definitions/actions",
			value: { type:"number", description: "threshold in °C" },
		},
	}
}

DS1820.getApiDescription = function() {
	return [
		{	cmd:"getValue",
			effect:"returns the temperature in degrees Celsius"
		},
	];
}

module.exports.DS1820 = DS1820;
