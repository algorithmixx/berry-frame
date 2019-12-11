"use strict";

const Logger		= require("../utils/Logger.js").Logger;
const isMissing 	= require("../utils/Logger.js").isMissing;
const isPresent 	= require("../utils/Logger.js").isPresent;

const theHardware	= require("../hw_control/Hardware.js").theHardware;

// =========================================================================================================

class Server {

	// A server which listens at a given port for http requests and then establishes a web socket connection
	// to its clients. The server passes client requests to the Hardware and transmits the resulting changes
	// of hardware states to its clients.
	// Apart from that, it gets informed if hardware elements like e.g. push buttons 
	// change their state by a physical user interaction with the hardware; in such cases it publishes 
	// status change information to all connected clients.
	// It also handles the registration process between a special "MASTER server" and normal Berry servers.
	// The only purpose of the master server is to provide a list of currently active servers.
	// Normal Berry servers ask for this list whenever a client connects them freshly and deliver the
	// list to the connecting client. To get an update of that list a client must reconnect to its server.  
	
	// HTTP is used for
	// 		a) Loading of the client UI (HTML,CSS,JS,images,sounds)
	// 		b) REST-API calls which allow access to hardware elements
	// 		c) Communication between Berry servers and their master server
	// Socket communication is used for
	//		a) direct responses to a client socket request, delivering hardware configuration and full state
	//		   of the hardware
	//		b) transmitting a list of available servers to a client
	//		c) direct responses to single getValue() requests, delivering selected hardware status information
	//		d) broadcasts to push changed state(s) to all connected clients

	constructor() {
	} 

	configure(appTypes,appType,name,rev,port,master,exclude,browse) {
		// the behavior of a server depends on being of type=="server" or "master"
		
		
		this.name		= name;									// a symbolic name for the server
		this.type		= appType.name;							// "master" or any appType name
		this.title		= appType.title;						// title
		this.desc		= appType.desc;							// short description
		this.rev		= rev;									// hardware revision
		this.port		= port;									// the port to be used
		this.master		= master;								// the addresse of the master
		this.baseDir	= __dirname+'/..';						// the directory above the client with (HTML,CSS,images,JS)
		this.exclude	= exclude;								// disable admin-like client UI features
		this.browse		= browse;								// open the site in that browser after startup
		
		theHardware.exclude(this.exclude);	// optionally exclude certain client features like "reboot Raspi" etc

		if (theHardware.appObject) theHardware.appObject.setServer(this);
		
		// if we are a Master, we can offer to start all Berries mentioned in the appTypes list
		// because they sit on the same machine as ourselves
		if (this.type=="Master") this.startableServers=appTypes;
	} 

	update() {
		// triggers npm update

		Logger.log("Server       updating package berry-frame ... ");

		const execSync = require('child_process').execSync;			
		execSync("npm update berry-frame");
		this.restart();
	}
	
	stop(wait) {
		// unregister the server and exit from the running process
		
		// inform the application that we are going to stop
		if (theHardware.appObject && theHardware.appObject.onStop) theHardware.appObject.onStop();
			
		if (isMissing(wait)) wait=1000;
		var my=theServer;
		var delay=0;
		if (my.type!="Master") {
			// unregister at master
			my.tellMaster("exit");
			delay=wait;
		}
		Logger.info(my.logName+"       exiting ..");
		theHardware.release();
		setTimeout(function() {
			process.exit(); //exit completely
		},delay);
	}

	shutDown(reboot) {
		// unregister the server and exit from the running process
		// then halt or reboot the machine completely (if on Raspi)
		// you must have invoked once before:   sudo chmod 4755 /sbin/shutdown

		var my=theServer;
		Logger.info(my.logName+"       SHUT DOWN + "+(reboot?"reboot":"halt"));
		if (process.platform !== "win32") {
			my.stop(2000);
			setTimeout(function() {
				const { spawn } = require('child_process');
				spawn('/sbin/shutdown', [(reboot?'-r':'-h'),'now']);
			},1000);
		}
		else {
			// under windows: reboot == just restart the application (do not reboot windows)
			if (reboot) my.restart();
			else my.stop();
		}
	}
	
	restart() {
		// restart the application
		Logger.info("Server       restarting ..",process.argv);
		const fs=require('fs');
		fs.writeFile("./restart.cmd","@rem "+new Date().toString()+"\n@"
			+'"'+process.argv.join('" "')+'"'+"\n",
			function(err) { if(err) Logger.error(err); }
		);
		theServer.stop(1000);
	}
	
	start(initialActions) {
		// import libraries needed by the server

		this.http 		= require('http').createServer(this.handleHttp);
		this.fs 		= require('fs');	 					// filesystem module
		this.io 		= require('socket.io')(this.http) 		// socket.io module (pass the http handler object)
		this.ip			= require("ip").address();
		this.createdAt	= new Date().getTime();
		this.logName	= (this.type=="Master") ? "Master":"Server";

		var my=this;
		
		// make sure that resources will be released upon CTRL+C
		process.on('SIGINT', my.stop);
		
		// install WebSocket connection handler
		this.io.sockets.on('connection', this.handleSocketAsServer);

		// install hardware interrupt watchers for all "out" devices
		// and have them broadcast their changed states to all connected clients
		
		for (var elm of Object.values(theHardware.elms)) {
			if (elm.dev && elm.dev.direction=="out") {
				Logger.info("Server       installing output watcher for "+elm.type+":"+elm.id);
				elm.dev.onChanged(function (err,device,type,value) {
					if (err)	Logger.error(my.logName+": ",err); 
					else 		my.broadcastState(device,type,value);
				},false);
			}
			else if (elm.type=="DS1820") {
				Logger.info("Server       installing input watcher for "+elm.type+":"+elm.id);
				elm.dev.onChanged(function (err,device,type,value) {
					if (err)	Logger.error(my.logName+": ",err); 
					else 		my.broadcastState(device,type,value);
				},false);				
			}
			else if (elm.type=="MPU6500") {
				Logger.info("Server       installing input watcher for "+elm.type+":"+elm.id);
				elm.dev.onChanged(function (err,device,type,value) {
					if (err)	Logger.error(my.logName+": ",err); 
					else 		my.broadcastState(device,type,value);
				},false);	
			}
		}
		
		// start http-listening forever
		this.http.listen(this.port);
		Logger.info(this.logName+'       HTTP listening at '+this.port+' ..  serving from "'+this.baseDir+'"');

		if (this.type!="Master") {
			// if we are a normal server: register at the master server
			this.tellMaster("new");
		}

		// if we are the master: create an (empty) list of registrations
		// and add ourselves to the list
		if (this.type=="Master") {
			this.registrations=[{
				op:			"new",
				type:		my.type,
				name:		my.name,
				title:		my.title,
				desc:		my.desc,
				rev:		my.rev,
				createdAt:	my.createdAt,
				ip:			my.ip,
				port:		my.port,
			}];
		}
		
		
		// open the local default browser if requested (useful primarily for tests under Windows)
		if (this.browse) {
			require('child_process').exec("rundll32 url.dll,FileProtocolHandler http://localhost:"+this.port);
		}
			
		// invoke the startup function of the application object;
		// if we have initialActions to be performed, pass a function to the application object
		// which will allow it to perform those actions

		var my=theServer;
		if (theHardware.appObject && theHardware.appObject.onStart) {
			if (initialActions) {
				theHardware.appObject.onStart(function() { 
					my.performAction(initialActions.split(";"));
				});
			}
			else {
				theHardware.appObject.onStart( null );
			}
		}
		else {
			// perform initial action
			if (initialActions!="") {
				this.performAction(initialActions.split(";"));
			}
		}
		
	}
	
	performAction(actions,done) {
		// executes the first element in the list
		// and recursively calls itself with the shifted list
		// so, finally all cmds will be played one after the other
		
		var action = actions.shift();
		// surround with {}, embrace attributes with quotes
		var actionJson = ("{"+action+"}")
			.replace(/([a-zA-Z][a-zA-Z_0-9]*) *:/g,'"$1":')
			.replace(/:([a-zA-Z][a-zA-Z_0-9 ]*)/g,':"$1"')
		;
		var my=this;
		if (actions.length>0)	this.action(null,actionJson,function(proc) { my.performAction(actions,done);	});	
		else 					this.action(null,actionJson,done);	
	}
	
	handleSocketAsServer(socket) {
		// define how a normal Berry server will react upon socket requests from our clients
		
		var my=theServer;

		socket.on('disconnect', function() {
			var address = socket.handshake.address;
			Logger.log("Server       SOCKET client disconnected "+address);
		});
		
		socket.on('action', function(actionJson) { my.action(socket,actionJson); });
		
	}

	action(socket,actionJson,onFinished) {
		// defines the reaction on requests which may come from a socket connection
		// or from a http REST request (socket==null in that case)
		
		Logger.log("Server       SOCKET received action "+actionJson);
		var my=theServer;
		var action;
		try {
			action=JSON.parse(actionJson);
		}
		catch (e) {
			var msg = "invalid JSON cmd: "+actionJson+" , "+e.toString();
			if(socket) this.sendError(socket,msg);
			return {msg};
		}

		if 		(action.id=="server") {
			
			// ACTIONS referring to the SERVER as a whole
			
			if (action.cmd=="stop" || action.cmd=="restart" || action.cmd=="update") {
				// client wants to stop the server
				try {
					if(theHardware.appObject && theHardware.appObject.onStop) {
						theHardware.appObject.onStop(function() {
							if 		(action.cmd=="stop") 		my.stop();
							else if (action.cmd=="restart") 	my.restart();
							else if (action.cmd=="update")		my.update();
						});
					}
					else {
						my.http.close();
						if 		(action.cmd=="stop") 		my.stop();
						else if (action.cmd=="restart") 	my.restart();
						else if (action.cmd=="update")		my.update();
					}
				}
				catch(err) {
					console.info(err);
				}
			}
			else if (action.cmd=="start") {
				if (!action.type) return {msg:"type required"};
				else return my.startABerry(action.type,action.name||action.type);				
			}
			else {
				// REST API for harware configuration and current state			
				if 		(action.cmd=="getSetup")	return theHardware.getSetupJson();
				else if (action.cmd=="getState")	return theHardware.getAllStatesJson();
				else if (action.cmd=="getServers")	return my.otherServers;
				else return {msg:"unknown cmd: "+action.cmd};
			}
			
		}

		else if	(action.id=="hardware") {
			
			// ACTIONS referring to the HARDWARE as a whole
			
			if 		(action.cmd=="getAll") {
				// socket client is freshly connected and wants everything
				// send complete hardware config, state and server list
				this.sendFullState(socket);
			}
			else if (action.cmd=="shutdown" || action.cmd=="reboot") {
				// client wants to stop the server
				try {
					if(theHardware.appObject && theHardware.appObject.onStop) {
						theHardware.appObject.onStop(function() {
							my.http.close();
							if 		(action.cmd=="shutdown")	my.shutDown(false);
							else if (action.cmd=="reboot") 		my.shutDown(true);
						});
					}
					else {
						my.http.close();
						if 		(action.cmd=="shutdown")	my.shutDown(false);
						else if (action.cmd=="reboot") 		my.shutDown(true);
					}
				}
				catch(err) {
					console.info(err);
				}
			}
		}
		
		// ACTIONS referring to the hardware specific APPLICATION
		else if (action.id=="app") {
			// the element targets the app specific class (remote procedure call)
			return theHardware.appObject[action.cmd](null,action.arg);
		}
		
		// ACTIONS referring to the API
		else if (action.id=="api") {
			// the element targets the app specific class (remote procedure call)
			if (action.cmd=="help") return { help: theHardware.apiHelp(my.type) };
			return {error:"use cmd:help to see how the API can be used."};
		}

		// ACTIONS referring to individual hardware ELEMENTS

		else if (isPresent(action.id)) {
			var target=theHardware.elms[action.id];
			if (!target) {
				var msg="Server: There is no hardware device with id='"+action.id+"'";
				Logger.error(msg);
				return msg;
			}

			else if (target.type=="LED") {
				// execute blink command for a LED
				if (this.can(socket,"LED",target.id,["blink"],action.cmd)=="ok") {
					target.dev.blink(action.interval||500,action.ratio||50,action.duration,action.cycles||3);
					return {type:"LED",id:target.id,state:"blinking"};
				}
				if (this.can(socket,"LED",target.id,["toggle","on","off"],action.cmd)=="ok") {
					target.dev[action.cmd]();
					return {type:"LED",id:target.id,state:target.dev.getValue()};
				}
				else if (this.can(socket,"LED",target.id,["getValue"],action.cmd)=="ok") {
					return {type:"LED",id:target.id,state:target.dev.getValue()};
				}
				else {
					var msg="Server: unknown action for LED: "+JSON.stringify(action);
					Logger.error(msg);
					return msg;
				}
			}

			else if (target.type=="PWDevice") {
				// execute dim command for a PWDevice
				var elm=theHardware.elms[action.id];
				if (this.can(socket,"PWDevice",action.id,["setDutyCycle"],action.cmd)=="ok") {
					elm.dev.setDutyCycle(action.value);
					return {type:"PWDevice",id:action.id,state:"dutyCycle="+action.value};
				}
				else if (this.can(socket,"PWDevice",action.id,["getValue","getDutyCycle"],action.cmd)=="ok") {
					return {type:"PWDevice",id:action.id,state:elm.dev.getValue()};
				}
				else {
					var msg="Server: unknown action for PWDevice: "+JSON.stringify(action);
					Logger.error(msg);
					return msg;
				}
			}

			else if (target.type=="Button") {
				// Button action
				if (this.can(socket,"Button",target.id,["pressed","down","up"],action.state)=="ok") {
					Logger.log("Server       Button "+target.id+ " -- "+action.state);
					target.dev.press(action.state);
					return {type:"Button",id:target.id,state:action.state};
				}
				else {
					var msg="Server: unknown action for Button: "+JSON.stringify(action);
					Logger.error(msg);
					return msg;
				}
			}

			else if (target.type=="WS2801") {
				// client wants to play an LED strip procedure
				if (this.can(socket,"WS2801",target.id,["play"],action.cmd)=="ok") {
					var ok=target.dev.play(onFinished,action.prog);
					if (ok) return {type:"WS2801",id:target.id,state:"playing",prog:action.prog};
					if (socket) this.sendError(socket,'WS2801 '+action.WS2801+' cannot play "'+action.prog);
					return {type:"WS2801",id:target.id,state:"cannot play",prog:action.prog};
				}
				else {
					var msg="Server: unknown action for WS2801: "+JSON.stringify(action);
					Logger.error(msg);
					return msg;
				}
			}

			else if (target.type=="MPU6500") {
				// client wants to get the current orientation
				if (this.can(socket,"MPU6500",target.id,["getValue","setValue"],action.cmd)=="ok") {
					if (action.cmd=="getValue") {
						var orientation=target.dev.getValue();
						if (socket) this.sendResponse(socket,{type:"MPU6500",id:target.id,value:orientation});
						return {type:"MPU6500",id:target.id,value:orientation};
					}
					else {
						target.dev.setValue(action.value);
						return {type:"MPU6500",id:target.id,value:action.value};
					}
				}
				else {
					var msg="Server: unknown action for MPU6500: "+JSON.stringify(action);
					Logger.error(msg);
					return msg;
				}
			}

			else if (target.type=="Speakers") {
				// client wants a sound file to be played
				if (this.can(socket,"Speakers",target.id,["play"],action.cmd)=="ok") {
					var ok=target.dev.play(action.prog);
					if (ok) return {type:"Speakers",id:target.id,state:"playing "+action.prog};
					if (socket) this.sendError(socket,'Speakers '+target.id+' cannot play "'+action.prog);
					return {type:"Speakers",id:target.id,state:"cannot play "+action.prog};
				}
				else {
					var msg="Server: unknown action for Speakers: "+JSON.stringify(action);
					Logger.error(msg);
					return msg;
				}

			}
			else if (target.type=="Display") {
				// client wants the msg to be shown
				target.dev.println(action.arg);
				return {type:"Display",id:target.id,msg:action.arg};
			}
			else if (target.type=="TextInput") {
				// client sends text input
				if (target.changed && target.changed.elm=="app") {
					return theHardware.appObject[target.changed.cmd](null,action.arg);
				}
				else {
					return theHardware.elms[target.changed.elm].dev[target.changed.cmd](action.arg);
				}
			}
			else if (target.type=="Action") {
				// client tells us that an action was selected
				var elm, cmd, arg;
				if (!action.value) action.value=target.options[0].value;
				for (var opt of target.options) {
					if ((!opt.value && opt!=action.value) || (opt.value && opt.value!=action.value)) continue;
					if (target.selected) {
						elm = target.selected.elm;
						cmd = target.selected.cmd;
						arg = target.selected.arg;
					}
					if (opt.elm) elm=opt.elm;
					if (opt.cmd) cmd=opt.cmd;
					if (opt.arg) arg=opt.arg;
					if (!opt.arg) arg = action.value;
					break;
				}
				if (elm=="app") return theHardware.appObject[cmd](null,arg);
				else return theHardware.elms[elm].dev[cmd](arg);
			}
			else {
				var msg="Server: unknown action: "+JSON.stringify(action);
				Logger.error(msg);
				return msg;
			}
		}
		
		else {
			var msg="Server: message not understood: "+JSON.stringify(action);
			Logger.error(msg);
			return msg;
		}
	}
	
	can(socket,type,id,cmds,cmd) {
		// return true if the device is present and if we know the cmd
		if (isMissing(theHardware.elms[id])) {
			var msg = "unknown "+type+" '"+id+"'";
			if (socket) this.sendError(socket,msg); 
			return msg;
		}
		var dev = theHardware.elms[id].dev;
		if (typeof dev!="object" || dev.constructor.name!=type) {
			var msg = "device '"+id+"' is not a "+type; 
			if (socket) this.sendError(socket,msg); 
			return msg;
		}
		if (!cmds.includes(cmd)) {
			var msg=type + " "+id+": unknown cmd: "+cmd+" known cmds:"+JSON.stringify(cmds); 
			if (socket) this.sendError(socket,msg); 
			return msg;
		}
		return "ok";
	}
	
	startABerry(type,name) {
		// start a server by writing the startup command to a file
		// where it hopefully will be picked up by the monitor
		Logger.info("Server       starting berry "+type+": "+name);
		const fs=require('fs');
		fs.writeFile("./restart.cmd","@rem "+new Date().toString()+"\n@"
			+"node node_modules/berry-frame/Berry -n "+name+" "+type+"\n",
			function(err) { if(err) Logger.error(err); }
		);
		return {msg:"starting berry, type="+type+", name="+name};
	}

	tellMaster(op,callback) {
		var my=theServer;
		const request = require('request');
		var uri = "http://"+my.master+"/reg?"+JSON.stringify({
			op:			op,
			type:		my.type,
			name:		my.name,
			title:		my.title,
			rev:		my.rev,
			createdAt:	my.createdAt,
			ip:			my.ip,
			port:		my.port,
		});
		Logger.info("Server       to MASTER register "+op);
		request(uri, function(error,response, body) {
			if (response && response.body) {
				Logger.info("Server       got list of active servers from master: "+response.body);
				var servers=JSON.parse(response.body);
				// remove ourselves from the list
				/*
				for (var s=0;s<servers.length;s++) {
					if (servers[s].createdAt!=my.createdAt || servers[s].ip!=my.ip || servers[s].port!=my.port) continue;
					servers.splice(s,1);
					break;
				}
				*/
				var msg = JSON.stringify({servers:servers});
				my.otherServers=servers;
				if (callback) callback();
			}
			else {
				Logger.info("Server       could not register at Master");
			}
		});
	}

	broadcastState(device,type,value)	 {
		var my=theServer;
		var msg = JSON.stringify({states:[{id:device.id,type:type,value:value}]});
		// transmit to all connected clients
		if ((type!="WS2801" && type!="MPU6500") || Logger.level>=2) Logger.log("Server       SOCKET broadcast "+msg);
		my.io.emit('state',msg);
	}

	sendFullState(socket) {
		// transmit (a) hardware setup, (b) states of all devices, (c) list of other servers
		// to a freshly connected client
		
		var my=theServer;
		
		Logger.log("Server       SOCKET sending hardware setup: "+JSON.stringify(theHardware.getSetupJson(),null,4));
		socket.emit('state',JSON.stringify(theHardware.getSetupJson()));

		var response=JSON.stringify(theHardware.getAllStatesJson());
		Logger.log("Server       sending ALL STATES "+response);
		socket.emit('state',response);
		
		if (my.type!="Master") {
			// if we are a normal server: register at the master server
			my.tellMaster("get",function() {
				response=JSON.stringify(my.otherServers);
				Logger.log("Server       SOCKET sending list of registered servers "+response);
				socket.emit('registeredServers',response);
			});
		}
		else {
			socket.emit('registeredServers',JSON.stringify(my.registrations));
			socket.emit('startableServers',JSON.stringify(my.startableServers));
		}
	}
	
	sendError(socket,msg) {
		var response=JSON.stringify({error:msg});
		Logger.error("Server       SOCKET sending error: "+msg);
		// transmit only to the specific client
		if (socket) socket.emit('state',response);
	}

	sendResponse(socket,response) {
		// transmit a single message to a singel socket client, 
		// typically as a response to a request of that client
		var msg=JSON.stringify({states:[response]});
		Logger.log("Server       SOCKET response "+msg);
		socket.emit('state',msg);
	}

	handleHttp(request,response) {
		// handle http requests (as a normal server or as the master)
		// file requests will be serverd from the berry/client directory
		// if, however, a URI starts with "/app/" it will be served from the
		// directory with the berries (which must be the pwd where you started the Berry server)
		
		var my=theServer;
		
		var ip = request.headers['x-forwarded-for'] || 
			request.connection.remoteAddress || 
			request.socket.remoteAddress ||
			(request.connection.socket ? request.connection.socket.remoteAddress : null)
		;
		var uri="";
		try {
			uri = decodeURI(request.url);
		}
		catch(e) {
			Logger.error(e,request.url);
		}
		if (uri=="" || uri=="/") uri= "/index.html"; // empty URI -> index.html
		
		// if the uri starts with "/reg?" it is interpreted as a registration request
		if (my.type=="Master" && uri.substr(0,5)=="/reg?") {
			Logger.log("Master       received registration request: "+uri.substr(5));
			my.register(uri.substr(5),response);
			return response.end();
		};

		// if the uri starts with "/api?" it is interpreted as a REST API call
		if (uri.substr(0,5)=="/api?" || uri.substr(0,5)=="/api/") {
			var actionJson = ("{"+uri.substr(5)+"}")
				.replace(/([a-zA-Z][a-zA-Z_0-9]*) *:/g,'"$1":')
				.replace(/:([a-zA-Z][a-zA-Z_0-9 ]*)/g,':"$1"')
			;
			Logger.log("Server       received API request: "+actionJson);
			var msg = my.action(null,actionJson,null);
			if (msg.help) {
				// deliver help text as pre-formatted HTML
				response.write("<pre>"+JSON.stringify(msg.help,null,4).replace(/\\n/g,"<br/>")+"</pre>");
			}
			else {
				response.write(JSON.stringify(msg));
			}
			return response.end();
		};

		// if the uri starts with "/app/Master/" it is interpreted as a file reference to the Master client
		// if the uri starts with "/app/" it is interpreted as a file reference to the application client
		// all other files are relative to the generic web client
		var file;
		if (uri.substr(0,12)=="/app/Master/") {
			file=my.baseDir+"/"+uri.substr(5);
		}
		else if (uri.substr(0,5)=="/app/") {
			file="./"+uri.substr(5);
		}
		else {
			file=my.baseDir+"/client/"+uri;
		}
		
		// all other requests are file references
		var ext = file.replace(/.*[.]/,'');
		Logger.log("Server       HTTP request from "+ip+"  url="+uri+"  file="+file);
		
		// deliver a file from the baseDir
		my.fs.readFile(file, function(error, data) {
			if (error) {
				 //display 404 on error
				response.writeHead(404, {'Content-Type': 'text/html'});
				return response.end("404 Not Found");
			}
						
			// deliver prettified HWD as HTML

			if (ext=="hwd") {
				response.writeHead(200, {'Content-Type': 'text/html'});
				var name =  uri.replace(/^.*\//,"");
				var prefix=`
				<html>
					<head>
						<meta charset="utf-8">
						<link rel="stylesheet" type="text/css" href="/css/HWD.css">
						<title>Berry: `+name+`</title>
					</head>
					<body>
						<h2>Berry Hardware description: &nbsp; <i>`+name+`</i></h2>
						<div id="hwd">`;
				var postfix=`</div></body></html>`;
				response.write(prefix+my.escapeHTML(data.toString())+postfix);
				return response.end();
			}

			// deliver all other know file types
			
			if 		(ext=="js" ) response.writeHead(200, {'Content-Type': 'text/javascript'});
			else if (ext=="jpg") response.writeHead(200, {'Content-Type': 'img/jpg'});
			else if (ext=="png") response.writeHead(200, {'Content-Type': 'img/png'});
			else if (ext=="css") response.writeHead(200, {'Content-Type': 'text/css'});
			else if (ext=="zip") response.writeHead(200, {'Content-Type': 'application/zip'});
			else 				 response.writeHead(200, {'Content-Type': 'text/html'});
			response.write(data);
			return response.end();
		});
	}
	
	register(registrationJson,response) {
		// if we are the "master": accept a new registration or remove an existing one (or do nothing)
		// always send the current list of registered servers as a response
		var my=theServer;
		
		try {
			var registration=JSON.parse(registrationJson);

			if (registration.op=="new") {
				// add server to list	
				my.registrations.push(registration);
			}
			else if (registration.op=="exit") {
				// remove server from list
				for (var s=0;s<my.registrations.length;s++) {
					if (	registration.createdAt == my.registrations[s].createdAt
						&& 	registration.port == my.registrations[s].port ) {
						my.registrations.splice(s,1);
						break;
					}
				}
			}
			my.io.emit('registeredServers',JSON.stringify(my.registrations));
			my.io.emit('startableServers',JSON.stringify(my.startableServers));

		}
		catch(err) {
			; // ignore
		}	
		// send complete list of registered servers
		Logger.log("Master       responding with list of registered servers: "+JSON.stringify(my.registrations));
		response.write(JSON.stringify(my.registrations));
	}
	
	escapeHTML(unsafe) {
		return unsafe.replace(/[&<"']/g, function(m) {
			switch (m) {
				case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '"':
				return '&quot;';
			default:
				return '&#039;';
			}
		});
	}
}

// =========================================================================================================

// Create a single instance and export it
var theServer=new Server();
module.exports.theServer = theServer;