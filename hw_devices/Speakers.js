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

	say(text) {
		const fs = require('fs');
		const util = require('util');
		const client = new (require('@google-cloud/text-to-speech').TextToSpeechClient)();
		const request = { 
			input: { text: text }, 
			voice: { 
				languageCode: 'de-DE', 
				ssmlGender: 'FEMALE', 
				name: 'de-DE-Wavenet-A' 
			}, 
			audioConfig: { 
				audioEncoding: 'MP3' 
			}, 
		}; 
		var that=this;
		(async () => { 
			const [response] = await client.synthesizeSpeech(request); 
			const writeFile = util.promisify(fs.writeFile); 
			await writeFile(that.appType+"/audio/google-speech.mp3", response.audioContent, 'binary'); 
		})();
	}
	
	play(fileName) {
		// play the given file (wav format)
		// if there is already a file being played the request will be ignored.
		// if fileName contains commas, it gets split along the commas and a random element will be played
		
		if (this.fileName!="--") {
			if (this.watcher) this.watcher(0,this,"Speakers","already playing .. "+this.fileName);
			return false;
		}
		if (typeof fileName!="string") {
			Logger.error("Speakers "+this.id+": filename is not a string: "+fileName);
			return false;
		}
		this.fileName=fileName;
		if (this.fileName.indexOf(",")>0) {
			var names = fileName.split(",");
			this.fileName = names[Math.floor(Math.random()*names.length)];
		}	
		if (process.platform === "win32") {
			Logger.log("Speakers     playing (Windows): "+this.fileName+" ..");
			if (this.fileName.toLowerCase().endsWith(".mp3")) {
				var childProc = require('child_process'); 
				try {
					childProc.spawn('.\\node_modules\\berry-frame\\bin\\mpg123',
							["./"+this.appType+"/audio/"+this.fileName], {stdio:"inherit"}
					);
					// we should change this only after the sub process has terminated.
					var that=this;
					setTimeout(function() { 
						that.fileName="--"; 
						if (that.watcher) that.watcher(0,that,"Speakers",that.fileName);
					},5000);
				}
				catch(e) {
					console.log(e);
				}					
			}
			else if (this.fileName.toLowerCase().endsWith(".wav")) {
				var player = require('node-wav-player');
				var that=this;
				player.play({
					path: "./"+that.appType+"/audio/"+that.fileName,
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
				Logger.error("Speakers     can only play formats: wav, mp3");
			}
		}
		else {
			if (this.fileName.toLowerCase().endsWith(".mp3")) {
				var childProc = require('child_process'); 
				try {
					childProc.spawn('omxplayer', ["./"+this.appType+"/audio/"+this.fileName], {stdio:"inherit"});
					// we should change this only after the sub process has terminated.
					var that=this;
					setTimeout(function() { 
						that.fileName="--"; 
						if (that.watcher) that.watcher(0,that,"Speakers",that.fileName);
					},5000);
				}
				catch(e) {
					console.log(e);
				}					
			}
			else if (this.fileName.toLowerCase().endsWith(".wav")) {
				const Sound	= require('node-aplay');
				var file = this.appType+"/audio/"+this.fileName;
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
		}
		if (this.watcher) this.watcher(0,this,"Speakers",this.fileName);
		return true;
	}

	playMorse(code,unit) {
		unit = unit || 150;
		Logger.log("Speakers     playing Morse ("+unit+"): "+code);
		new MorseSnd().play(code,unit);		
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
		{	cmd:"say",
			args:[
				{name:"text",meaning:"a German text to be converted to speech by Google TTS"}
			],
			effect:"resulting mp3 file will be in audio/google-speech.mp3"
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

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// under windows npm install speaker fails; so we can use server sound only on the Raspi
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

var audioCtx=false;
if (process.platform != "win32") {
	try {
		const Speaker = require('speaker');
		const AudioContext = require("web-audio-engine").StreamAudioContext;
		audioCtx = new AudioContext();
		audioCtx.pipe(new Speaker());
		audioCtx.resume();
	}
	catch (e) {
		// ignore silently; "speaker" will not be there during the very firstChild
		// invocation of berry-frame on a Raspi ..
	}
}

class MorseSnd {

	constructor() {
		// server-side audioCtx is only available on the Raspi
		
		if (!audioCtx) return;		// audio context must have been created
		
		// create gain
		this.gain		= audioCtx.createGain();
		this.gain.connect(audioCtx.destination);

		// create oscillator
		this.oscillator = audioCtx.createOscillator();
		this.oscillator.type = 'sine';
		this.oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // value in hertz
		this.oscillator.connect(this.gain);
	}
	
	play(text) {
		if (!audioCtx) return;		// audio context must have been created	
		this.oscillator.start();
		this.morse(text,0,130);
	}

	morse(text,pos,base) {
		if (pos>=text.length) {
			this.oscillator.stop();
			return;
		}
		var snd=true;
		var that=this;
		if (text[pos]==" ") {
			this.gain.gain.setValueAtTime(0,audioCtx.currentTime);
			setTimeout(function() {	that.morse(text,pos+1,base); },3*base);
		}
		else {
			var duration = (text[pos]=="-" ? 3*base : base);
			this.gain.gain.setValueAtTime(1,audioCtx.currentTime);
			setTimeout(function() {	that.gain.gain.setValueAtTime(0,audioCtx.currentTime); }, duration);
			setTimeout(function() {	that.morse(text,pos+1,base); },duration+base);
		}
	}
}

module.exports = Speakers;
