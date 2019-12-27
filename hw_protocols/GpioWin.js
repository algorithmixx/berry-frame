"use strict";
const	Logger 		= require("../utils/Logger.js").Logger;

// =========================================================================================================

class GpioWin {
	
	constructor(gpio,direction) {
		console.log("GpioWin      using gpio "+gpio+"-"+direction+" (emulation)");
		this.left=':.........:.........:.......'.substr(0,gpio);
		this.right=':.........:.........:.......'.substr(gpio+1);
		this.gpio=gpio;
		this.direction=direction;
		this.value=0;
		this.setTime(new Date().getTime());
		this.visualize=true;
	}

	quiet() {
		this.visualize=false;
	}
	
	setTime(time) {
		this.startedAt = time;		
	}
	
	readSync() {
		return this.value;
	}

	writeSync(value) {
		var now=new Date().getTime();
		this.value=value;
		if (!this.visualize) return;
		if(Logger.level>=2) Logger.log(
			(now-this.startedAt+"").padStart(24)+" / "
			+this.gpio+(this.direction=='in'?' ← ':' → ')
			+this.left+(this.value==0?' ':'█')+this.right
		);
		// if (this.watcher) this.watcher(null,value);
	}

	watch(watcher) {
		this.watcher = watcher;
	}
	
	unexport() {
		console.log("GpioWin      unexporting device at gpio "+this.gpio);
	}

}

GpioWin.HIGH = 1;
GpioWin.LOW  = 0;

// =========================================================================================================


module.exports.GpioWin = GpioWin;