
class BerryUI {

	// the generic user interface of a Berry server
	// communicates via sockets with one or more Berry servers
	// displays their front panels based on the hardware description
	// optionally displays a list of all interface elements with their attributes
	// can connect to a master server which offers a list of available Berry servers
	
	constructor() {
		//load socket.io-client and connect to the host that serves the page
		
		this.version		= "0.9";

		// this should be fetched from the master
		this.servers		= [];
		this.sockets 		= [];
		this.connectRetries	= [];
		this.hardwares 		= [];
		this.gpios			= [				// GPIO for pin#
			 0,
			 0, 0, 2, 0, 3, 0, 4,14, 0,15,
			17,18,27, 0,22,23, 0,24,10, 0,
			 9,25,11, 8, 0, 7, 0, 0, 5, 0,
			 6,12,13, 0,19,16,26,20, 0,21,
		];
		
		window.onunload = function() {
			for (var socket of app.sockets) socket.disconnect();
		}
		
		this.registeredServers= [];
		this.startableServers = [];
	}

	addServer(server) {
		// add a server to the list of connections, create a panel for it in the UI

		this.servers.push( server );
		this.sockets.push( io(server, {timeout:10000}) );
		var hw=this.servers.length-1;
		this.createPanel(hw);
		this.installSocketHandlers(hw);
		// initially request the full state from the server
		this.sendAction(hw,{elm:"hardware",cmd:"getAll"});
	}

	removeServer(hw) {
		// close the connection to a server and remove its virtual front panel
		// hw identifies the connection to the server

		var my=app;
		my.sockets[hw].close();
		my.connectRetries[hw]=0;
		my.hardwares[hw]={};
		my.servers[hw]="";
		my.dropPanel(hw);
	}

	disableServer(hw) {
		// drop the Panel but try to re-establish the connection
		var my=app;
		my.dropPanel(hw);
	}

	installSocketHandlers(hw) {
		// install handlers for the socket connection to a given server
		// hw identifies the connection to the server

		var my=this;
		
		var socket=this.sockets[hw];

		socket.on('state', function (jsonMsg) {
			var hw=0;
			my.connectRetries[hw] = 0;
			while(app.sockets[hw]!=this && ++hw<app.sockets.length) ;	// find connection index

			var response = JSON.parse(jsonMsg);
			
			// handle responses which describe an error that occurred on the server
			if (response.error) {
				alert("Server response:\n\n"+response.error);
				my.connectRetries[hw] = 1;
				return;
			}
			
			// handle the initial setup response (hardware setup)
			if (response.setup) {
				var hardware=response.setup;

				// create instance var for the hardware belonging to this connection
				my.hardwares[hw]=hardware;					

				// draw the front panel of the hardware
				my.drawPanel(hw,response);

				// set browser tab title
				$("title").html(hardware.type+": "+hardware.name);
				
				// set title
				if (hw==0) $("#title").html(hardware.title);
				
				my.connectRetries[hw] = 1;
				return;
			}

			// handle a response describing the state of one or all hardware elements
			if (response.states && my.hardwares[hw]) {
				for (var device of response.states) {
					if		(device.type=="ADS1115") {
						// show the current voltage
						var val= ""+device.value;
						$("#hw_"+hw+"_"+device.id).html(val);
					}
					else if (device.type=="Display") {
						// show the contents of the display
						$("#hw_"+hw+"_"+device.id).html(device.value.join("<br/>"));
					}
					else if (device.type=="DS1820") {
						// show the current temperature
						var val= ""+device.value+" °C";
						$("#hw_"+hw+"_"+device.id).html(val);
					}
					else if (device.type=="MPU6500") {
						// show the current orientation
						app.updateRotations(hw,device.id,device.value);
					}
					else if (device.type=="PWDevice") {
						// show the current duty cycle
						var elm=my.hardwares[hw].elms[device.id];
						var val= Math.round(elm.range[0]+(elm.range[1]-elm.range[0])*(device.value-elm.duty[0])/(elm.duty[1]-elm.duty[0]));
						$("#hw_"+hw+"_"+device.id).val(val);
						$("#hw_"+hw+"_v_"+device.id).html((""+val).padStart(3));
						$("#hw_"+hw+"_a_"+device.id).css({transform: 'rotate('+(val+180)+'deg)'});
						if (elm.drives) {
							var driven = my.hardwares[hw].elms[elm.drives];
							if (driven && driven.type=="LED") {
								$("#hw_"+hw+"_"+elm.drives).css({
									opacity: 0.6+(val*0.004),
									filter:"brightness("+(0.4+val*0.006)+")",
									backgroundColor:(val>0) ? driven.color : "#ccc",
								});
							}
						}
					}
					else if (device.type=="Speakers") {
						if (device.value=="--") {
							$("#hw_"+hw+"_"+device.id).css("background", "#bbb");
							$("#hw_"+hw+"_"+device.id).html("🔊 -- 🔊");
						}
						else if (typeof device.value== "string") {
							// show the current music title and play it directly
							$("#hw_"+hw+"_"+device.id).css("background", "#bfb");
							$("#hw_"+hw+"_"+device.id).html("🔊 "+device.value+" 🔊");
							var music = new Audio();
							music.src="app/"+my.hardwares[hw].type+"/audio/"+device.value;
							music.play();
						}
						else if (typeof device.value && device.value.morse) {
							// produce Morse code
							new MorseSnd().play(device.value.morse,device.value.unit|| 150);
						}
					}
					else if (device.type=="WS2801" && device.value) {
						// LED strip
						var data = device.value.data;
						for(var l=0,v=0;v<data.length;l++,v+=3) {
							$("#s_"+hw+"_"+l).css("background", "rgb("+my.ledAdjust(data[v])+","+my.ledAdjust(data[v+1])+","+my.ledAdjust(data[v+2])+")");
						}
					}
					else {
						// all other devices
						$("#hw_"+hw+"_"+device.id).css("background", (device.value==1 ? my.hardwares[hw].elms[device.id].color:"#bbb"));
					}
				}
			}

			my.connectRetries[hw] = 1;
		});

		// handle a message containing a list of registered servers
		socket.on('registeredServers', function (jsonMsg) {
			// list of other servers
			my.updateRegisteredServers(jsonMsg);
		});			

		// handle a message containing a list of servers
		// which could be started by the Master
		socket.on('startableServers', function (jsonMsg) {
			// list of local startable servers
			my.updateStartableServers(jsonMsg);
		});			

		// handle connection errors (including timeout)
		socket.on('error', function (msg) {
			alert("error "+msg);
		});
		socket.on('connect', function (msg) {
			if (my.connectRetries[hw] > 0) {
				my.notify("reconnected to "+this.io.uri);
				my.connectRetries[hw] = 1;
				setTimeout(function() { 
					location.reload(true); 
				},1000 );
			}		
			my.connectRetries[hw]=1;	// make sure that we reload on next reconnect
		});
		socket.on('connect_error', function (msg) {
			++my.connectRetries[hw];
			my.notify("cannot connect (#"+my.connectRetries+" of 10) to "+this.io.uri);
			// stop further tries when limit reached
			if (my.connectRetries[hw]>=10) this.disconnect();
		});
		socket.on('timeout', function (msg) {
			alert("timeout "+msg);
		});

	}
	
	updateRegisteredServers(jsonMsg) {
		$("#servers").html("");
		var servers = JSON.parse(jsonMsg);
		if (app.hardwares[0].type=="Master") app.registeredServers=[];
		for (var server of servers) {
			var serverAddress=location.protocol+"//"+location.hostname+":"+server.port;
			var color = (server.type==app.hardwares[0].type) ? "background-color:#eef;" : "";
			if (server.type=="Master") {
				if (app.hardwares[0].type!="Master") {
					$("#servers").append(
						"<a title='"+serverAddress+"' target='Master' href='"+location.protocol+"//"+location.hostname+":"+server.port+"'>Master</a><br/>"
					);
				}				
			}
			else {
				$("#servers").append(
					"<button title='"+serverAddress+"' onclick='app.addServer(\""+serverAddress+"\");' style='"+color+"'>"+
					"<span style='display:inline-block;text-align:right;width:70px;'><i>"+server.type+"</i></span> &nbsp; "+
					"<span style='display:inline-block;text-align:left;width:100px;'><b>"+server.name+"</b></span> &nbsp; "+
					"</button><br/>"
				);
			}
			app.registeredServers[server.type] = server;
		}
		
	}
	
	updateStartableServers(jsonMsg) {
		// if we are the master: create buttons to start Berry applications

		if (app.hardwares[0].type=="Master") {
			var html="";
			var s=-1;
			app.startableServers=JSON.parse(jsonMsg);
			for (var type in app.startableServers) {
				s++;
				if (type=="Master") continue;
				if (app.registeredServers[type]) {
					// server is already active
					var server=app.registeredServers[type];					
					html+="<a target='"+type+"' href='"+location.protocol+"//"+location.hostname+":"+server.port+"'>OPEN</a> &nbsp; ";
					html+= "<i>"+type+"</i> <b>"+server.name+"</b> &nbsp; [ "+server.ip+" : "+server.port+" ] ";
					html+="<span style='color:green'>running since "+new Date(server.createdAt).toLocaleString()+"</span> &nbsp; ";
					html+= "<div style='margin-top:5px;margin-left:100px;'>"+server.title+"</div><hr/>";
				}
				else {
					var server=app.startableServers[type];					
					html+="<button onclick='app.startServer(\""+type+"\");'>start</button> &nbsp; ";
					html+= "<i>"+type+"</i> <b>"+server.name+"</b> &nbsp; [ "+server.port+" ]";
					html+= "<div style='margin-top:5px;margin-left:100px;'>"+server.title+"</div><hr/>";
				}
			}
			// #manager is a field in the UI of the Master (see server/Master.hwd)
			$('#manager').html(html);
		}
	}
	
	startServer(type) {
		var server = app.startableServers[type];
		app.sendAction(0,{elm:"server",cmd:"start",type:type,name:server.name});
	}
	
	createPanel(hw) {
		// display the virtual front panel for the hardware of a given server
		// hw identifies the connection to the server
		
		var html=`
			<div id="hwimg_`+hw+`" style="float:right;display:inline-block;vertical-align:top;"></div>
			<div id="hw_`+hw+`" class="FrontPanel">
				<div id="hardware_`+hw+`"></div>
				<div id="hardwareName_`+hw+`"></div>
			</div>
			<div style="clear:both"></div>
			<div id="hardwareDetails_`+hw+`" style="display:none">
				<div id="hardwareDesc_` +hw+`" class="hwDesc"></div>
				<div id="hardwareIface_`+hw+`"></div>
				<div id="hardwareSetup_`+hw+`"></div>
			</div>
		`;
		$("#hardwares").append(html);
	}
	
	dropPanel(hw) {
		// remove the virtual front panel for the hardware of a given server
		// hw identifies the connection to the server

		$("#hw_"+hw).remove();
		$("#hwimg_"+hw).remove();
	}
	
	drawPanel(hw,response) {
		// initially all panels are hidden; now show the panel for the current connection
		$("#hw_"+hw).show();

		var hardware=response.setup;
		
		// show the front panel elements belonging to the current type of hardware
		$("#hw_"+hw+" .ui_"+hardware.type).css("display","");

		// append image of hardware
		if (hardware.img) {
			$("#hwimg_"+hw).html("<img style='vertical-align:top;max-height:300px;max-width:300px' src='app/"+hardware.type+"/img/"+hardware.img+"'></img>");
		}
		
		var d=new Date(hardware.creationTime);
		var date = 
			// ("0" + d.getDate()).slice(-2) + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + d.getFullYear() + " " + 
			("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2)
		;

		var controlButtons1="";
		if (hardware.exclude.indexOf("rs")<0 && hardware.exclude.indexOf("all")<0) controlButtons1+=
			"<button title='RESTART berry-frame Server' onclick='app.sendAction("+hw+",{elm:\"server\",cmd:\"restart\"});app.disableServer("+hw+");'>"+
			"<span style='color:blue;font-weight:700;'>&#8635;</span></button>&nbsp;"
		;
		if (hardware.exclude.indexOf("rb")<0 && hardware.exclude.indexOf("all")<0) controlButtons1+=
			"<button title='REBOOT Raspberry Pi computer' onclick='app.sendAction("+hw+",{elm:\"hardware\",cmd:\"reboot\"});app.disableServer("+hw+");'>"+
			"<span style='color:blue;font-weight:700;'>&#8635;&#8635;</span></button>&nbsp;"
		;
		var controlButtons2="";
		if (hardware.exclude.indexOf("U")<0 && hardware.exclude.indexOf("all")<0) controlButtons2+=
			"<button title='berry-frame, version "+hardware.version+",\n click to UPDATE (via npm) and RESTART!' onclick='app.sendAction("+hw+",{elm:\"server\",cmd:\"update\"});'>"+
			"<span style='color:magenta;font-weight:700'>&#8659;</span></button>&nbsp;"
		;
		if (hardware.exclude.indexOf("S")<0 && hardware.exclude.indexOf("all")<0) controlButtons2+=
			"<button title='STOP berry-frame server' onclick='app.sendAction("+hw+",{elm:\"server\",cmd:\"stop\"});app.removeServer("+hw+");'>"+
			"<span style='color:red;font-weight:700'>x</span></button>&nbsp;"
		;
		if (hardware.exclude.indexOf("X")<0 && hardware.exclude.indexOf("all")<0) controlButtons2+=
			"<button title='SHUTDOWN and HALT Raspberry Pi computer' onclick='app.sendAction("+hw+",{elm:\"hardware\",cmd:\"shutdown\"});app.removeServer("+hw+");'>"+
			"<span style='color:red;font-weight:700;'>xx</span></button>&nbsp;"
		;

		$("#hardwareName_"+hw).html(
			"<button title='show/hide details on this Berry Application' onclick='$(\"#hardwareDetails_"+hw+"\").toggle();'><i>"+hardware.type+"</i></button> &nbsp; "+
			"<b>"+hardware.name+"</b> &nbsp; "+
			( hw && app.hardwares[0].type!="Master" ?
					"<button title='disconnect' onclick='app.removeServer("+hw+");'>x</button>&nbsp;" 
					: 
					controlButtons1+
					"<a title='get help on the API and use it in a separate browser tab' target='api' "+
					"style='color:green;text-decoration:none;font-weight:700;' href='/api?elm:api,cmd:help'>API</a>&nbsp;|&nbsp;"+
					"<a title='open hardware description in a separate browser tab' target='hwd' "+
					"style='color:green;text-decoration:none;font-weight:700;' href='/app/"+app.hardwares[hw].type+"/server/"+app.hardwares[hw].type+".hwd'>HWD</a>&nbsp;|&nbsp;"+
					"<a title='download this Berry' "+
					"style='color:green;text-decoration:none;font-weight:700;' href='/app/zip/"+app.hardwares[hw].type+".zip'>&dArr;</a>&nbsp; "+
					controlButtons2
			) +
			" &nbsp; "+
			(hw==0 ? location.hostname+":"+location.port : app.servers[hw])+
			"&nbsp; &nbsp; "+date+" &nbsp;"
		);
		
		// description
		$("#hardwareDesc_"+hw).html(
			hardware.desc+"<p/>"+
			"Versions: &nbsp; &nbsp; hardware: "+hardware.rev+" &nbsp; &nbsp; "+
			"server: "+hardware.version+" &nbsp; &nbsp; "+
			"client: "+this.version+"<br/>"
		);
		
		// Interface (pins / gpios)
		
		var pih="<img style='float:right;margin-left:10px;' src='img/pinout.png'/><table class='iface'>";	// pin layout html
		pih+="<tr><th>Device</th><th>Signal</th><th>Pin</th><th>Pin</th><th>Signal</th><th>Device</th></tr>";
		var color;
		for (var p=39;p>=1;p-=2) {
			var pp=p+1;
			pih+="<tr><td>";
			var pin  = response.pins[p];
			var ppin = response.pins[pp];
			var pSignal  =  pin.signal.replace(/GPIO_([0-9]+)/,"GPIO <b><span style='color:red'>$1</span></b>&nbsp;");
			var ppSignal = ppin.signal.replace(/GPIO_([0-9]+)/,"GPIO <b><span style='color:red'>$1</span></b>&nbsp;");
			color="magenta"; // out
			var cable="";
			for (var elm of Object.values(hardware.elms)) {
				if (typeof elm.gpios!="undefined" && elm.gpios.includes(app.gpios[pp])) {
					if (elm.cable) cable="<br/>"+elm.cable;
					if (elm.direction=="in") color="green";
					break; 
				}
			}
			if (ppin.type) 	pih+="<span style='color:"+color+"'><b>"+ppin.type+"</b></span> : "+ppin.name;
			else pih+="&nbsp;";
			pih+=cable+"</td><td>"+ppSignal+"</td><td><b>"+pp+"</b></td><td><b>"+p+"</b></td><td>"+pSignal+"</td><td>";
			color="magenta"; // out
			cable="";
			for (var elm of Object.values(hardware.elms)) {
				if (typeof elm.gpios!="undefined" && elm.gpios.includes(app.gpios[p])) {
					if (elm.cable) cable="<br/>"+elm.cable;
					if (elm.direction=="in") color="green";
					break;
				}
			}
			if (pin.type) 	pih+="<span style='color:"+color+"'><b>"+pin.type+"</b></span> : "+pin.name+cable;
			else pih+="&nbsp;";
			pih+="</tr>";
			if (pp==28) pih+="<tr><td colspan='6'><hr/></td></tr>";
		}
		pih+="</table>";
		$("#hardwareIface_"+hw).append(pih);
		
		// hardware elements (list) and panel ==========================================================
		
		for(var elm of Object.values(hardware.elms)) {

			var showElm = JSON.parse(JSON.stringify(elm));	// deep copy
			// eliminate some members
			delete showElm.name;
			delete showElm.log;
			delete showElm.emu;

			// add description of the element to the setup list
			var html = "<hr/>";
			html+= 	"<div style='margin-top:10px'>";
			html+= 	"	<div style='vertical-align:top;display:inline-block;width:100px;'>";
			html+=	"		<i>"+elm.name+"</i>:";
			html+=  "	</div>";
			html+=	"	<div style='display:inline-block;width:500px;'>";
			html+=			JSON.stringify(showElm)
								.replace(/"(.*?)"/g,"$1")
								.replace(/([,;:])/g,"$1 ")
								.replace(/^\{/,'')
								.replace(/\}$/,'')
								.replace(/api:/,'<br/>api:')
								.replace(/style:/,'<br/>style:')
								.replace(/protocol:/,'<br/>protocol:')
							;
			html+=	"	</div>";
			html+=	"</div>";
			$("#hardwareSetup_"+hw).append(html);

			
			// produce visual representation of the element on the front panel
			var it="";	// hardware item html
			
			if 		(elm.type=="Action") {
				if (elm.options.length==1) {
					var value = elm.options[0].value;
					if (!value) value = elm.options[0]; 
					// Action without alternatives
					it=	"<button id='hw_"+hw+"_"+elm.id+"' title='"+(elm.title||"")+"' class='"+elm.type+"' style='"
						+elm.style+"' onclick='app.sendAction("+hw+",{elm:\""+elm.id+"\",value:\""+value+"\"});'>"+value+"</button>";
				}
				else {
					// Action with multiple string values or with multiple option objects (value, elm, cmd, arg)
					var opts="";
					for (var opt of elm.options) {
						if (typeof opt == "string") opts+= "<option>"+opt+"</option>";
						else  opts+="<option>"+opt.value+"</option>";
					}
					it=	"<select id='hw_"+hw+"_"+elm.id+"' title='"+(elm.title||"")+"' class='"+elm.type+"' style='"
						+elm.style+"'"+" onmouseup='var open=$(this).data(\"isopen\"); if(open) { app.sendAction("
						+hw+",{elm:\""+elm.id+"\",value:$(this).val()})}; $(this).data(\"isopen\",!open);'"
						+">"+opts+"</select>"
					;
				}
			}

			else if (elm.type=="ADS1115") {
				it="	<div id='hw_"+hw+"_"+elm.id+"' title='"+(elm.title||elm.name)+"' class='"+elm.type+"' style='"+elm.style+"'>?</div>";
			}

			else if (elm.type=="Button") {
				if (elm.color) elm.style+=";background-color:"+elm.color+";";
				// we have a button which will be handled individually by the application
				var handles = "";					
				if (elm.pressed				) handles += "' onclick='app.sendAction("+hw+",{elm:\""+elm.id+"\",state:\"pressed\"});'";
				if (elm.down || elm.downUp	) handles += " onmousedown='app.sendAction("+hw+",{elm:\""+elm.id+"\",state:\"down\"});'";
				if (elm.up || elm.downUp	) handles += " onmouseup='app.sendAction("+hw+",{elm:\""+elm.id+"\",state:\"up\"});'";
				it=	"<button id='hw_"+hw+"_"+elm.id+"' title='"+(elm.title||"")+"' class='"+elm.type+"' style='"
					+elm.style+"'"+handles+">"+elm.name+"</button>";
			}

			else if (elm.type=="Display") {
				it="<div id='hw_"+hw+"_"+elm.id+"' title='"+(elm.title||"")+"' class='"+elm.type+"' style='"+elm.style+"'></div>";
			}

			else if (elm.type=="DS1820") {
				it="	<div id='hw_"+hw+"_"+elm.id+"' title='"+(elm.title||elm.name)+"' class='"+elm.type+"' style='"+elm.style+"'>?</div>";
			}

			else if (elm.type=="FrontPanel") {
				// the panel itself
				if (elm.style) $("#hardware_"+hw)[0].style=elm.style;
				if (elm.title) $("#hardware_"+hw).prop("title",elm.title);
			}

			else if (elm.type=="Label") {
				it="<div id='hw_"+hw+"_"+elm.id+"' title='"+(elm.title||"")+"' class='"+elm.type+"' style='"+elm.style+"'>"+elm.name+"</div>";
			}

			else if (elm.type=="LED") {
				it="<div id='hw_"+hw+"_"+elm.id+"' title='"+(elm.title||"")+"' class='"+elm.type+"' style='"+elm.style+"'><div style='margin-top:5px;padding-left:5px;padding-right:5px;'>"+elm.name+"</div></div>";
			}

			else if (elm.type=="Microphone") {
				it="	<div id='hw_"+hw+"_"+elm.id+"' title='"+(elm.title||"")+"' class='"+elm.type+"' style='"+elm.style+"'>🎤"+elm.name+"</div>";
			}

			else if (elm.type=="MPU6500") {
				elm.rot=[0,0,0];
				it="<div id='hw_"+hw+"_"+elm.id+"' title='"+(elm.title||"")+"' class='"+elm.type+"' style='"+elm.style+"'>"+`
					<div style="display:inline-block;margin-top:5px;vertical-align:top;">
						<div>
							<label>X</label>
							<input style="width:120px;" class="rotX" type="range" min="0" max="359" value="`+elm.rot[0]+`" oninput="app.sendRotation(`+hw+`,'`+elm.id+`',0,(this.value-`+elm.orientation[0]+`)%360)">
						</div>
						<div>
							<label>Y</label>
							<input style="width:120px;" class="rotY" type="range" min="0" max="359" value="`+elm.rot[1]+`" oninput="app.sendRotation(`+hw+`,'`+elm.id+`',1,(this.value-`+elm.orientation[1]+`)%360)">
						</div>
						<div>
							<label>Z</label>
							<input style="width:120px;" class="rotZ" type="range" min="0" max="359" value="`+elm.rot[2]+`" oninput="app.sendRotation(`+hw+`,'`+elm.id+`',2,(this.value-`+elm.orientation[2]+`)%360)">
						</div>
					</div>
					<div class="MPU6500_bg">
						<div style="width:100px;height:100px;perspective:600px;perspective-origin:50% 50%;">
							<x-model class="MPU6500_model" src="app/Sword/img/`+elm.image3d+`" 
							style="width:80%;height:80%;margin:10%;border:2px solid #fbb;"></x-model>
						</div>
					</div>
				</div>`;
				$("#hardware_"+hw).append(it);
			}

			else if (elm.type=="PWDevice") {
				// pulse width modulation
				if (!elm.duty) elm.duty=[0,1];
				if (!elm.range) elm.range=[0,100];
				var val=""+elm.duty[0]+"+"+(elm.duty[1]-elm.duty[0])+"*(this.value-"+elm.range[0]+")/"+(elm.range[1]-elm.range[0]);
				it= "<div class='slidecontainer' style='"+elm.style+"' title='"+(elm.title||"")+"'>"
					+"<input type='range' min='"+elm.range[0]+"' max='"+elm.range[1]+"' class='slider' id='hw_"+hw+"_"+elm.id
					+"' oninput='app.sendAction("+hw+",{elm:\""+elm.id+"\",cmd:\"setDutyCycle\",\"value\":"+val+"});'/>"
					+"<span id='hw_"+hw+"_v_"+elm.id+"' style='float:right'>50</span>"
					+"<span display:'inline-block'>"+elm.name+"</span>&nbsp;&nbsp;<span id='hw_"+hw+"_a_"+elm.id+"' style='display:inline-block;font-size:150%;font-weight:800'>→</span></div>"
				;
			}

			else if (elm.type=="Speakers") {
				it="	<div id='hw_"+hw+"_"+elm.id+"' title='"+(elm.title||"")+"' class='"+elm.type+"' style='"+elm.style+"'>"+elm.name+"🔊</div>";
			}		

			else if (elm.type=="Task") {
				// tasks are not shown in the client
				it="";
			}		

			else if (elm.type=="TextInput") {
				it="<div id='hw_"+hw+"_"+elm.id+"' title='"+(elm.title||"")+"' class='"+elm.type+"' style='"+elm.style+"'>"
					+"<textarea rows='"+elm.rows+"' cols='"+elm.cols+"'></textarea><button onclick='app.sendTextInput("+hw+",\""+elm.id+"\");' style='vertical-align:top'>&#9166;</button></div>";
			}

			else if (elm.type=="WS2801") {
				it ="<div id='hw_"+hw+"_"+elm.id+"' title='"+(elm.title||elm.name)+"' class='"+elm.type+"' style='"+elm.style+"'>";
				it+="	<div style='position:relative'>";
				it+="		<div style='position:absolute;left:-90px;top:20px;background:#e7e7e7;border:dashed 1px black;width:88px;height:30px;'></div>";
				it+="		<div style='position:absolute;left:40px;display:inline-block;background:#e7e7e7;border:dashed 1px lightgray;width:"+(elm.numLEDs/2*31+50)+"'>";
				var mid=Math.floor(elm.numLEDs/2);
				for (var l=0,nr=elm.numLEDs-1,ll=elm.numLEDs-1;l<elm.numLEDs;l++) {
					if (l<mid) {
						it+="<div class='WS2801_led' title='"+nr+"' id='s_"+hw+"_"+nr+"'>&nbsp;</div>";
						nr--;
					}
					else if (l==mid) {
						it+="<br/>";
						if (elm.numLEDs%2) it+="<div class='WS2801_led' id='s_"+hw+"_"+nr+"' title='"+nr+"' style='margin-left:"+((l+1)*27)+"px'>&nbsp;</div><br/>";
						else { 
							l--;
							mid=0;
						}
						nr=0;
					}
					else {
						it+="<div class='WS2801_led' title='"+nr+"' id='s_"+hw+"_"+nr+"'>&nbsp;</div>";
						ll--;
						nr++;
					}
				}
				it+="</div></div></div>";
			}

			else {
				alert("I don´t know how to display elements of type "+elm.type);
			}

			$("#hardware_"+hw).append(it);
			
		}

		$("#hwimg_"+hw+" img").css({maxHeight: $("#hw_"+hw).height()});


	}

	sendAction(hw,obj) {
		// serialize an object and send it as an 'action' to a given server
		app.sockets[hw].emit('action',JSON.stringify(obj));
	}

	sendTextInput(hw,id) {
		var value=$("#hw_"+hw+"_"+id+" textarea").val();
		app.sendAction(hw,{elm:id,arg:value});
	}
	
	sendRotation(hw,id,axis,val) {
		var elm=app.hardwares[hw].elms[id];
		elm.rot[axis]=parseInt(val);
		var x = (elm.rot[0]+elm.orientation[0]) % 360;
		var y = (elm.rot[1]+elm.orientation[1]) % 360;
		var z = (elm.rot[2]+elm.orientation[2]) % 360;
		$("#hw_"+hw+"_"+id+" .MPU6500_model").css({ transform:"rotateX("+x+"deg) rotateY("+y+"deg) rotateZ("+z+"deg)" });
		app.sendAction(hw,{elm:id,cmd:"setValue",value:elm.rot});
	}

	updateRotations(hw,id,val) {
		var elm=app.hardwares[hw].elms[id];
		elm.rot[0]= (val[0]+360) % 360;
		elm.rot[1]= (val[1]+360) % 360;
		elm.rot[2]= (val[2]+360) % 360;		
		var x = (elm.rot[0] + elm.orientation[0]) % 360;
		var y = (elm.rot[1] + elm.orientation[1]) % 360;
		var z = (elm.rot[2] + elm.orientation[2]) % 360;
		$("#hw_"+hw+"_"+id+" .rotX").val(x);
		$("#hw_"+hw+"_"+id+" .rotY").val(y);
		$("#hw_"+hw+"_"+id+" .rotZ").val(z);
		$("#hw_"+hw+"_"+id+" .MPU6500_model").css({ transform:"rotateX("+x+"deg) rotateY("+y+"deg) rotateZ("+z+"deg)" });
	}
	
	api(hw,id,cmd) {
		var url=app.servers[hw]+"/api?elm:"+id+",cmd:"+cmd;
		if (app.apiWindow) {
			app.apiWindow.url=url;
		}
		else {
			app.apiWindow=window.open(url,"_blank");
		} 
		app.apiWindow.focus();
	}
	
	ledAdjust(val) {
		// adjust the perceived brightness of a LED
		if (val==0) return 0;
		return 80+Math.round(val/1.75);
	}
		

	buttonClicked(event) {
		// send button press command to server
		var tokens=event.id.split("_");
		var hw=tokens[1];
		var deviceId = tokens[2];
		this.sendAction(hw,{button:deviceId,state:'pressed'});
	}
	
	notify(msg) {
		// display an alert message to the user for three seconds
		$("#alert").append(msg+"<br/>").show();
		setTimeout(function() {$("#alert").html("").hide();},3000);
	}
	
	readme() {
		// show the Berry README.MD file in a separate browser tab
		if (app.readmeWindow) app.readmeWindow.url("readme.html");
		else app.readMeWindow=window.open("readme.html","readme");
		app.readmeWindow.focus();
	}
	
	convertMarkDown(tagSpec) {
		// take the current HTML contents for each element of the tag spec
		// eliminate leading tabs and interpret the text as MarkDown syntax
		// replace the element content by the translated MD
		$(tagSpec).each(function(inx, elm) {
			var indent="";
			var md = elm.innerHTML;
			if (md.substr(0,2)=="\n\t") md = md.replace(/\n\t+/g,"\n");
			var parsed = new commonmark.Parser().parse(md); // parsed is a 'Node' tree
			var result = new commonmark.HtmlRenderer().render(parsed); // result is a String
			elm.innerHTML=result;
		});
	}
	
}

var audioCtx;	// audio Context (Web Audio)

class MorseSnd {

	constructor() {
		if (!audioCtx) return;		// audio context must have been created
		
		// create web audio api context

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

var app;
window.addEventListener("load", function() { 
	app = new BerryUI(); 
	app.addServer(""); 
});
