# berry-frame

A framework for building Raspberry Pi applications with a web browser interface.


# DISCLAIMER

__Berry-Frame__ is still being tested and has therefore not yet been made available publically.
Release is planned for Dec, 2019.

Please be patient ..


## Introduction

If you write applications for small embedded computers like the _Raspberry Pi_
you will quickly notice that more than 70% of your program code does not really deal
with the application logic itself but with technical issues like accessing
a certain device or handling communication between your Raspi and a web client.

__BerryFrame__ offers a way to separate all this generic technical stuff from the
real application logic. It has a _server part_ running under _node.js_ on the 
_Raspberry Pi_ and a _client part_ running within the _browser_. The server part
includes a http service listening at a configurable port. The server establishes
a web socket connection to the client and it also offers a REST-like API.

__BerryFrame__ can be installed under Windows where the server part will provide
some minimalistic emulations for missing hardware peripherals.

The applications you build with __BerryFrame__ are called _Berries_.
	
__BerryFrame__ is not a "graphical tool for drawing your programming logic".

__BerryFrame__ is based on a structured description of your hardware peripherals 
in JSON-syntax ('``HWD``'). The HWD notation also establishes some standard 
rules for visual representation of hardware elements in the browser UI 
and for the general flow of information between UI elements and 
hardware devices connected to the Raspi´s GPIO ports.

As soon as things get more complex, you will have to provide some Javascript
code (preferibly ES6 standard) to describe the logic of your application
(sitting on the server). If you want to customize the UI you can also add code 
and resource files to the client side.


## Documentation

Detailled documentation for __Berry_Frame__ is available under _(berry-frame)/client.readme.html_.
When running your _Berry_ the browser UI will conatin a link to that documentation.


## Example

There is a demo website which shows a _Berry_ called "Hello".
The _Hello Berry_ has a LED and two buttons. Button-A is a push button: The LED
will be ON while you hold this button down. Button-B is a switch button which toggles
the LED between ON and OFF. The _Hello Berry_ is so simple that it only needs
a simple hardware description file (``Hello.hwd``) and no additional Javascript
on the server or on the client.

Try the _Hello Berry_: https://followthescore:9001  
The web UI contains a link the HWD file so that you see what was needed
to build that _Berry_.

A slightly more complex example is the _Dimmer Berry_.
Try it at https://followthescore:9005  
This time we needed to add our own server-side class ("Dimmer.js") which provides
the specific application logic. The UI has a link to show its source code.

	
## Installation

```
npm install berry-frame
```

After installing __Berry-Frame__ have a look into the documentation and follow
the setup steps described there.

## Usage

```javascript
var berryFrame = new (require('berry-frame').BerryFrame)();

berryFrame.load();
```

## License: ISC
