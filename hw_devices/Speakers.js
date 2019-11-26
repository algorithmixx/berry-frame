const Logger 	= require("../utils/Logger.js").Logger;
const isMissing = require("../utils/Logger.js").isMissing;
const isPresent = require("../utils/Logger.js").isPresent;

const Device	= require("./Device.js").Device;

class Speakers extends Device {
	// represents a pair of speakers (data=pin #40)
	// The hardware is an I2S-based soundcard with microphone.
	// It uses GPIOs 16,18,19,21 and has a button on 23 and an LED on 25
	// the microphone on the same card uses GPIO 20

	constructor(id,name,appType,emulate) {

		super(id,name,[],emulate);	// do not use "traditional" inout GPIO pins
		this.gpios = [16,18,19,21];	// in fact, the GPIO Pins are configured to use the I2S protocol
		Logger.info("Speakers     creating "+name+" I2S protocol [16,18,19,21] "+(emulate?" (emulation)":""));
		this.direction = "out";
		this.protocol="I2S";
		this.fileName="--";
		this.appType=appType;
		this.watcher=null;
	}

	play(fileName) {
		// play the given file (wav format)
		// if there is already a file being played the request will be ignored.
		// if fileName contains commas, it gets split along the commas and a random element will be played
		
		if (this.fileName!="--") {
			if (this.watcher) this.watcher(0,this,"Speakers","already playing .. "+this.fileName);
			return false;
		}
		this.fileName=fileName;
		if (this.fileName.indexOf(",")>0) {
			var names = fileName.split(",");
			this.fileName = names[Math.floor(Math.random()*names.length)];
		}	
		if (process.platform === "win32") {
			// actually remain silent as the client will play the sound and it may be on the same machine
			Logger.log("Speakers     playing (Windows): "+this.fileName+" ..");
			var player = require('node-wav-player');
			var that=this;
			player.play({
				path: "./"+that.appType+"/audio/"+that.fileName+".wav",
				sync:true,
			}).then(() => {
				// when music ends: reset the current fileName and send message
				that.fileName="--";
				if (that.watcher) that.watcher(0,that,"Speakers",that.fileName);
			}).catch((err) => {
				Logger.error(err);
			});
		}
		else {
			const Sound	= require('node-aplay');
			var file = this.appType+"/audio/"+this.fileName+".wav";
			var music = new Sound(file);
			Logger.log("Speakers     playing (Raspi): "+this.fileName+" ..");
			music.play();
			var that=this;
			if (that.watcher) {
				// when music ends: reset the current fileName and send message
				music.on ("complete", function () {
					that.fileName="--";
					that.watcher(0,that,"Speakers",that.fileName);
				});
			}
		}
		if (this.watcher) this.watcher(0,this,"Speakers",this.fileName);
		return true;
	}

	playMorse(code,unit) {
		Logger.log("Speakers     playing Morse (Raspi,"+unit+"): "+code);		
		if (this.watcher) {
			this.watcher(0,this,"Speakers",{morse:code,unit:unit});
		}
	}
	
	getValue() {
		return this.fileName;
	}
	
	onChanged(watcher) {
		this.watcher = watcher;
	}
	
	release() {
	}
}

Speakers.getApiDescription = function() {
	return [
		{	cmd:"play",
			args:[
				{name:"prog",meaning:"a wav filename without path and extension"}
			],
			effect:"plays the wav file from the client´s audio subdir"
		},
		{	cmd:"playMorse",
			args:[
				{name:"text", meaning:"a sequence of dots, dashes and spaces"},
				{name:"unit", meaning:"duration of dot-unit in msec"},
			],
			effect:"plays the corresponding more beep sound"
		}
	];
}

module.exports = Speakers;
