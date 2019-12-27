const Logger 	= require("../utils/Logger.js").Logger;
const isMissing = require("../utils/Logger.js").isMissing;
const isPresent = require("../utils/Logger.js").isPresent;

const Device	= require("./Device.js").Device;

/*
 A node.js library to control an ADS1115 analog-to-digital-converter
*/

/*
const _debug = require('debug')
const hex = (v) => v.toString(16).padStart(2, '0')
const bin = (v) => v.toString(2).padStart(16, '0')
_debug.formatters.h = (v) => v.length ? Array.prototype.map.call(v, b => hex(b)).join(' ') : hex(v)
_debug.formatters.b = bin
const debug = _debug('ADS1115')
const sleep = (t) => new Promise((resolve) => setTimeout(resolve, t))

const START_CONVERSION = 0b1000000000000000
const MUX = {
  '0+1':   0b0000000000000000,
  '0+3':   0b0001000000000000,
  '1+3':   0b0010000000000000,
  '2+3':   0b0011000000000000,
  '0+GND': 0b0100000000000000,
  '1+GND': 0b0101000000000000,
  '2+GND': 0b0110000000000000,
  '3+GND': 0b0111000000000000
}
const gains = {
  '2/3': 0b0000000000000000,  // +/- 6.144V
  '1':   0b0000001000000000,  // +/- 4.096V
  '2':   0b0000010000000000,  // +/- 2.048V
  '4':   0b0000011000000000,  // +/- 1.024V
  '8':   0b0000100000000000,  // +/- 0.512V
  '16':  0b0000101000000000,  // +/- 0.256V
}

module.exports = (bus, addr = 0x48, delay = 100, shift = 0) => {
  let gain = gains['2/3']

  const writeReg16 = (register, value) => {
    const buff = Buffer.from([register & 3, value >> 8, value & 0xFF])
    debug('write to 0x%h [%h]', addr, buff)
    return bus.i2cWrite(addr, 3, buff)
  }

  const readReg16 = async (register) => {
    await bus.i2cWrite(addr, 1, Buffer.alloc(1, register))
    const buff = (await bus.i2cRead(addr, 2, Buffer.allocUnsafe(2))).buffer
    debug('read from register 0x%h [%h]', register, buff)
    return (buff[0] << 8) | buff[1]
  }

  const readResults = async (value) => (await readReg16(0x00)) >> shift
  const writeConfig = (value) => {
    debug('writeConfig 0b%b', value)
    return writeReg16(0b01, value)
  }

  return {
    get gain() { return gain },
    set gain(level) {
      if (level === (2/3)) level = '2/3'
      gain = gains[level] || gain
    },

    writeLowThreshold: (threshold) => writeReg16(addr, 0b10, threshold << shift),
    writeHiThreshold: (threshold) => writeReg16(addr, 0b11, threshold << shift),

    measure: async (mux) => {
      mux = MUX[mux]
      if (typeof mux === 'undefined') throw new Error('Invalid mux')

      const config = 0x0183 // No comparator | 1600 samples per second | single-shot mode
      await writeConfig(config | gain | mux | START_CONVERSION)
      await sleep(delay)
      return readResults()
    }
  }
}
module.exports.open = (busNum, addr = 0x48, provider = 'i2c-bus') => {
  return require(provider).openPromisified(busNum).then((bus) => module.exports(bus, addr))
}
*/

class ADS1115 extends Device {

	constructor(id,name,channel,gain,scale,sps,emulate) {

		super(id,name,[],emulate);
		this.gpios		= [2,3];
		this.dev	 	= null;
		this.protocol	= "I²C";
		this.direction	= "in";
		this.address	= 0x48;
		this.gain		= gain;
		this.value		= 0;
		this.channel	= [
			0b01000000,	// 0 --> ch 0 vs. GND
			0b01010000, // 1 --> ch 1 vs. GND
			0b01100000, // 2 --> ch 2 vs. GND
			0b01110000, // 3 --> ch 3 vs. GND
			0b00000000, // 4 --> ch 0 vs. 1
			0b00010000, // 5 --> ch 0 vs. 3
			0b00100000, // 6 --> ch 1 vs. 3
			0b00110000,	// 7 --> ch 2 vs. 3
		][channel];
		this.gain = [
			0b00000000,	// 0 --> +/- 6.144V
			0b00000010,	// 1 --> +/- 4.096V
			0b00000100,	// 2 --> +/- 2.048V
			0b00000110,	// 3 --> +/- 1.024V
			0b00001000,	// 4 --> +/- 0.512V
			0b00001010,	// 5 --> +/- 0.256V
		][gain];
		this.range = [ 6144, 4096, 2048, 1024, 512, 256 ][gain];	// millivolt
		if (scale!=0) 	this.range = scale;
		this.sps = [
			0b00000000, //   8 samples per second
			0b00100000, //  16 samples per second
			0b01000000, //  32 samples per second
			0b01100000, //  64 samples per second
			0b10000000, // 128 samples per second
			0b10100000, // 250 samples per second
			0b11000000, // 475 samples per second
			0b11100000, // 860 samples per second
		][sps];
		this.spt = [ 150, 80, 40, 20,10, 6, 3, 2 ][sps]; 	// sampling time needed
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
			Logger.info("ADS1115      connecting");
		} catch (err) {
			Logger.error("error opening I²C device for ADS1115 (0x48), switching to emulation");
			this.emulate=true;
			this.dev = new (require('../hw_protocols/I2CWin.js').I2CWin)();
		}
		// request initial value
		this.loadValue(null);
	}

	word2Num(word) {
		// swap bytes and scale value
		return Math.round(this.range / 32768. *((word >> 8) + (word%256)*256)); 
	}

	loadValue(cb) {
		// trigger sampling and load value
		// set config register for a single shot, see data sheet for ADS1115
		const buff = Buffer.from([1, 128 | this.channel | this.gain | 1, this.sps | 3]);
		this.dev.writeSync(this.address, buff);

		// read values after time for taking samples is over
		var that=this;
		setTimeout( function() {
			that.dev.writeByteSync(that.address,0);	// tell the chip that we want to read from data register
			that.value = that.word2Num(that.dev.readWordSync(that.address));
			if (cb && typeof cb=="function") cb(that.value,true);
			Logger.log("ADS1115      "+that.address+" ["+that.channel+"] received from i2c bus: "+that.value);
			if (that.watcher) that.watcher(0,that,"ADS1115",that.value);
		},that.spt);
	}
	
	getValue(cb) {
		if (cb) this.loadValue(cb);
		else 	return this.value;
	}
		
	disconnect(callback) {
		// disconnect from I²C port
		
		//if (this.i2cDevice) this.i2cDevice.close(callback);
		this.dev=null;
	}	
}
ADS1115.schema = {
	properties: {
		channel:	{ type: "integer",
					  description: "channel vs GND: 0,1,2,3 or differential input: 4:=ch 0-1, 5:=ch 0-3, 6:ch 1-3, 7:=ch 2-3", default:0 },
		gain:		{ type: "integer", 
					  description: "voltage range -- 0:= ±6.144 V, 1:= ±4.096 V, 2:= ±2.048 V, 3:= ±1.024 V, 4:= ±0.512 V, 5:= ±0.256 V", default: 1 },
		scale:		{ type: "number",
					  description: "scale so that the given value will correspond to the maximum of the defined range, 0= do not scale", default: 0 },
		sps:		{ type: "integer",
					  description: "samples per second -- 0:= 8, 1:=16, 2:=32, 3:=64, 4:=128, 5:=250, 6:=475, 7:=860", default: 4 },
	},		
}

ADS1115.getApiDescription = function() {
	return [
		{	cmd:	"getValue",
			effect:	"returns analog value in Volts"
		}
	];
}

module.exports.ADS1115 = ADS1115;
