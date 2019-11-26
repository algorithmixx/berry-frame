const Logger 	= require("../utils/Logger.js").Logger;
const isMissing = require("../utils/Logger.js").isMissing;
const isPresent = require("../utils/Logger.js").isPresent;

const Device	= require("./Device.js").Device;

var microtime	= require('microtime');

/*
 A node.js library to control a WS2801 RGB LED strip via SPI with your Raspberry Pi
 @copyright 2013 Jürgen Skrotzky (MIT-License)
 revised 2019 by Gero Scholz
*/

class WS2801 extends Device {
	// note that communication with the strip hardware via SPI is asynchronous
	// This means that some methods have an argument which is a callback function

	constructor(id,name,numLEDs,emulate) {

		super(id,name,[],emulate);
		
		Logger.info("WS2801       creating LED strip with "+numLEDs+" LEDs"+(emulate?" (emulation)":""));

		
		if ((numLEDs !== parseInt(numLEDs)) || (numLEDs<1)) {
			Logger.error("WS2801: invalid param for number of LEDs, please use integer >0");
			return;
		}
		
		this.protocol		= "SPI";
		this.numLEDs 		= numLEDs;
		this.spiDevice 		= null;
		this.inverted 		= false;
		this.reversed 		= false;	
		this.redIndex 		= 0;
		this.greenIndex 	= 1;
		this.blueIndex 		= 2;
		this.bytePerPixel 	= 3; //RGB
		this.channelCount 	= this.numLEDs*this.bytePerPixel;

		// compute gamma correction table
		this.gammatable 	= new Array(256);
		for (var i=0; i<256; i++) {
			if 		(i==  0) this.gammatable[i] =  0;
			else if (i<  32) this.gammatable[i] =  1 ;
			else if (i<  64) this.gammatable[i] =  2 + Math.floor((i- 32) /16 );
			else if (i<  96) this.gammatable[i] =  4 + Math.floor((i- 64) / 8 );
			else if (i< 128) this.gammatable[i] =  8 + Math.floor((i- 96) / 4 );
			else if (i< 160) this.gammatable[i] = 16 + Math.floor((i-128) / 2 );
			else if (i< 192) this.gammatable[i] = 32 + Math.floor((i-160) / 1 );
			else if (i< 224) this.gammatable[i] = 64 + Math.floor((i-192) * 2 );
			else if (i< 256) this.gammatable[i] =128 + Math.floor((i-224) * 4 );
		}
		
		// Logger.log("rgb adjusted="+this.gammatable.join(","));
		
		// the buffer for all values, RGBRGBRGB...; the farest LED (from the beginning of the strip) is the first in the buffer
		this.values 		= Buffer.alloc(this.channelCount);

		this.rowResetTime 	= 1000; // number of usec CLK has to be pulled low (=no writes) for frame reset
									// manual of WS2801 says 500 is enough, however we need at least 1000
		this.lastWriteTime = 0;		//last time something was written to SPI

		this.progs = {};			// fix playing programs
		this.adjustedBuffer = {data:[]};
	}

	connect(spiDeviceName,clockSpeed){
		// connect to SPI port

		Logger.info("WS2801       connect "+spiDeviceName);
		
		this.spiDeviceName	= spiDeviceName;
		if (this.spiDeviceName.replace(/^[^0-9]+/,'')[0]=="0") {
			this.gpios=[10,11];
		}
		else {
			this.gpios=[20,21];
		}

		// get the device (instance of SPI / SPIWin)
		try{
			if (this.emulate) {
				var SPIWin = require('../hw_protocols/SPIWin.js').SPIWin;
				this.spiDevice = new SPIWin(this.spiDeviceName);
			}
			else {
				var SPI = require('pi-spi');
				this.spiDevice = SPI.initialize(this.spiDeviceName);
			}	
		} catch (err) {
			console.error("error opening SPI device "+this.spiDeviceName, err);
			return false;
		}

		// be careful; if speed is too high the chips on the strip will not receive correct data
		clockSpeed = clockSpeed || 2e6; // 2e6 seems to be the maximum for robust operations
		this.spiDevice.clockSpeed(clockSpeed);
	
		Logger.info("WS2801       connected to "+this.numLEDs+" triple LEDs, clock speed="+this.spiDevice.clockSpeed() );
	}

	disconnect(callback) {
		// disconnect from SPI port
		
		if (this.spiDevice) this.spiDevice.close(callback);
		this.spiDevice=false;
	}

	update(callback) {
		// send stored buffer with RGB values to WS2801 strip
		
		if (this.spiDevice) {
			this.sendRgbBuffer(this.values,callback);
		}  
	}
	
	sendRgbBuffer(buffer,callback){
		// send buffer with RGB values to WS2801 strip
		
		// apply gamma correction
		this.adjustedBuffer = Buffer.alloc(buffer.length);
		for (var i=0; i < buffer.length; i++) this.adjustedBuffer[i]=this.gammatable[buffer[i]];

		// checking if enough time passed for resetting strip
		if (process.platform == "win32" || microtime.now() > (this.lastWriteTime + this.rowResetTime)) {
			this.lastWriteTime = microtime.now();
			var that=this;
			this.spiDevice.write(this.adjustedBuffer,function(rc) {
				if (rc==null)	callback(buffer);
				else			Logger.error("SPI "+that.name+": could not write "+JSON.stringify(buffer));
			});
			return true;
		}
    
		Logger.info('WS2801       writing too fast, data dropped');
		return false;	
	}
	
	getValue() {
		return this.values;
	}
	getAdjustedValue() {
		return this.adjustedBuffer;
	}
	
	invert() {
		// toggle a flag which will invert all RGB buffer values upon sending to the strip
		this.inverted = !this.inverted;
	}
  
	reverse() {
		// toggle a flag which will send the RGB buffer in reverse order to the strip
		// reversed==true means that LED #0 will be the LED closest to the physical connection with the GPIOs

		this.reversed = !this.reversed;
	}

	clear(callback) {
		// switch all LEDs off
		
		this.fill(0,0,0,callback); 
	}

	fill(r,g,b,callback) {
		// fill whole strip with one color; send directly if callback given
		// Logger.log("WS2801       fill "+r+","+g+","+b,this.spiDevice);
		if (this.spiDevice) {      
			var colors = this.getRGBArray(r,g,b);
			for (var i=0; i<(this.channelCount); i+=3){
				this.values[i+0]=colors[0];
				this.values[i+1]=colors[1];
				this.values[i+2]=colors[2];
			}
			if (isPresent(callback)) this.sendRgbBuffer(this.values,callback);
		}    	
	}

	setColorIndex(redIndex, greenIndex, blueIndex) {
		// set new RGB index order

		this.redIndex = redIndex;
		this.greenIndex = greenIndex;
		this.blueIndex = blueIndex;
	}

	setColor(ledIndex, color) {
		// set color of led index [red, green, blue] from 0 to 255

		if (this.spiDevice) {
			var colors = this.getRGBArray(color[0],color[1],color[2]);
			var r = colors[0] / 255;
			var g = colors[1] / 255;
			var b = colors[2] / 255;
			var redChannel = this.getRedChannelIndex(ledIndex);
			this.setChannelPower(redChannel,   r);
			this.setChannelPower(redChannel+1, g);
			this.setChannelPower(redChannel+2, b);
		}
	}
	
	setChannelPower(channelIndex, powerValue) {
		// set power of channel from 0 to 1

		if (this.spiDevice) {  
			if(channelIndex > this.channelCount || channelIndex < 0) return false;
			if(powerValue < 0) powerValue = 0;
			if(powerValue > 1) powerValue = 1;
			this.values[channelIndex] = Math.floor((Math.pow(16, 2) - 1) * powerValue);
		}
	}
        
	setRGB(ledIndex, hexColor) {
		// set RGB hexcolor to LED index

		if (this.spiDevice) {
			var rgb = this.getRGBfromHex(hexColor);
			var colors = this.getRGBArray(rgb.r,rgb.g,rgb.b);
			var redChannel = this.getRedChannelIndex(ledIndex);
			this.setChannelPower(redChannel+this.redIndex,   colors[0]);
			this.setChannelPower(redChannel+this.greenIndex, colors[1]);
			this.setChannelPower(redChannel+this.blueIndex,  colors[2]);
		}
	}
         
	mySin (a, min, max) {
		return min + ((max-min)/2.)*(Math.sin(a)+1);
	} 

	rainbow (a) {
		var intense = 255;
		var r = parseInt(this.mySin(a, 0, intense));
		var g = parseInt(this.mySin(a+Math.pi/2, 0, intense));
		var b = parseInt(this.mySin(a + Math.pi, 0, intense));
		var colors = this.getRGBArray(r,g,b);
		return [colors[0],colors[1],colors[2]];
	} 

	getChannelCount() {
		return this.channelCount;
	}
    
	getRedChannelIndex(ledIndex) {
		return ledIndex * 3;
	}
        
	getGreenChannelIndex(ledIndex) {
		return ledIndex * 3 + 1;
	}
        
	getBlueChannelIndex(ledIndex) {
		return ledIndex * 3 + 2;
	}
  
	getRGBArray(r, g, b) {
		var colorArray = new Array(3);
		colorArray[this.redIndex] = r;
		colorArray[this.greenIndex] = g;
		colorArray[this.blueIndex] = b;
		if(this.inverted) {
			colorArray[0] = (1 - colorArray[0]/255)*255;
			colorArray[1] = (1 - colorArray[1]/255)*255;
			colorArray[2] = (1 - colorArray[2]/255)*255;
		}      
		return colorArray;
	}

	getRGBfromHex(color) {
		var r, g, b;
		if (color.length == 4) {
			r = parseInt(color.substr(1,1)+color.substr(1,1),16);
			g = parseInt(color.substr(2,1)+color.substr(2,1),16);
			b = parseInt(color.substr(3,1)+color.substr(3,1),16);
		}
		if (color.length == 7) {
			r = parseInt(color.substr(1,2),16);
			g = parseInt(color.substr(3,2),16);
			b = parseInt(color.substr(5,2),16);
		}
		var colors = this.getRGBArray(r,g,b);
		r = colors[0] / 255;
		g = colors[1] / 255;
		b = colors[2] / 255;
		if (r>=0 && r<=1 && g>=0 && g<=1 && b>=0 && b<=1) return {r:r,g:g,b:b};
		return {r:0,g:0,b:0};
	}
	
	loadProgs(progs) {
		this.progs=progs;
	}
	
	play(onFinished,progName) {
		if (this.progs[progName]) {
			this.progs[progName](onFinished,progName);
			return true;
		}
		return false;
	}
}

WS2801.getApiDescription = function() {
	return [
		{	cmd:"play",
			args:[
				{name:"prog",	meaning:"a symbolic name for a light program to be played"}
			],
			effect:"plays the program"
		}
	];
}

module.exports = WS2801;
