const Logger 	= require("../utils/Logger.js").Logger;
const isMissing = require("../utils/Logger.js").isMissing;
const isPresent = require("../utils/Logger.js").isPresent;

const Device	= require("./Device.js").Device;

/*
 A node.js library to control a MPU6500 motion and acceleration sensor
*/

class MPU6500 extends Device {
	// note that communication with the strip hardware via SPI is asynchronous
	// This means that some methods have an argument which is a callback function

	constructor(id,name,image3d,orientation,emulate) {

		super(id,name,[],emulate);
		this.gpios		= [2,3];
		this.dev	 	= null;
		this.protocol	= "I²C";
		this.direction	= "in";
		this.address	= 0x68;
		this.image3d	= image3d;
		this.orientation= orientation;
		this.value		= [0,0,0];
	}

	connect() {
		// connect to I²C port
		// if connection fails we fall back to emulation

		// get the device (instance of I²C)
		try{
			if (this.emulate) {
				this.dev = new (require('../hw_protocols/I2CWin.js').I2CWin)();
			}
			else {
				this.dev = new (require("raspi-i2c").I2C)();
			}	
			// Set powerControl register (wake up)
			Logger.info("MPU6500      connecting");
			this.dev.writeByteSync(this.address,107,0);
		} catch (err) {
			Logger.error("error opening I²C device for MPU6500 (0x68), switching to emulation", err);
			this.emulate=true;
			this.dev = new (require('../hw_protocols/I2CWin.js').I2CWin)();
		}

		var dir;
		for (var n=0;n<1;n++) {
			dir=this.getValue();
			Logger.log("MPU6500      direction:  "+dir[0]+" -- "+dir[1]+" -- "+dir[2]);
		}
	}

	getValue() {
		if (this.emulate) return this.value;
		
		// read 6 bytes containing the accelerations, HiByte first, Bit7 = sign
		var b = this.dev.readSync(this.address,0x3b,6);
		var v, ax,ay,az;	// accelerations
		v = b[0]*256+b[1]; ax= v<0x8000 ? v/16384. : -((65535-v)+1)/16384.; 
		v = b[2]*256+b[3]; ay= v<0x8000 ? v/16384. : -((65535-v)+1)/16384.; 
		v = b[4]*256+b[5]; az= v<0x8000 ? v/16384. : -((65535-v)+1)/16384.; 
		
		return [
			Math.round(180./Math.PI*Math.atan2(ax, Math.sqrt((ay*ay)+(az*az)))),
			Math.round(180./Math.PI*Math.atan2(ay, Math.sqrt((ax*ax)+(az*az)))),
			Math.round(180./Math.PI*Math.atan2(az, Math.sqrt((ax*ax)+(ay*ay)))),
		];
	}
	
	setValue(value) {
		this.value[0]=value[0];
		this.value[1]=value[1];
		this.value[2]=value[2];
		if (this.watcher) this.watcher(0,this,"MPU6500",this.value);
	}
	
	disconnect(callback) {
		// disconnect from I²C port
		
		//if (this.i2cDevice) this.i2cDevice.close(callback);
		this.dev=null;
	}	
}

MPU6500.schema = {
	description: "A motion and acceleration sensor using I2C protocol (0x68)",
	properties: {
		image3d:	{ type: "string", description: "e.g. xyz.glb, file must be in client/img directory"	},
		orientation:{ 
			type: 	"array",
			minItems:3,
			items: [ {type:"integer"}, {type:"integer"}, {type:"integer"} ],
			description: "x,y,z direction of sensor in default position",
			default: [0,0,0],
		},
	},
}

MPU6500.getApiDescription = function() {
	return [
		{	cmd:"getValue",
			effect:"returns spatial orientation as [x,y,z] in degrees"
		},
		{	cmd:"setValue",
			effect:"sets the (simulated) orientation as [x,y,z] in degrees",
			args: [
				{	name: "value", meaning: "[x,y,z] as three numeric values in degrees"  }
			]
		}
	];
}

module.exports = MPU6500;
