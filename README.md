# berry-frame

A framework for building _Raspberry Pi applications_ with a web browser interface.

The applications you build with __berry-frame__ are called ___berries___.


# DISCLAIMER

__berry-frame__ is still being tested and has therefore not yet been made available publically.
Release is planned for Dec, 2019.

Please be patient ..


## Introduction

If you write applications for small embedded computers like the _Raspberry Pi_
you will quickly notice that more than 70% of your program code does not really deal
with the application logic itself but with technical issues like accessing
a certain device or handling communication between your Raspi and a web client.

__berry-frame__ offers a way to separate all this generic technical stuff from the
real application logic. It has a _server part_ running under _node.js_ on the 
_Raspberry Pi_ and a _client part_ running within the _browser_. The server part
includes a http service listening at a configurable port. The server establishes
web socket connections to the clients and it also offers a REST-like API.

__berry-frame__ can be installed on a _Raspberry Pi_ and on other operating systems
like _Windows_. When installed on a platform which does not have GPIOs the server 
part will use some (minimalistic) emulation for missing hardware peripherals.
	
__berry-frame__ is not a "graphical tool for drawing your programming logic".

__berry-frame__ expects a structured description of your hardware peripherals 
in JSON-syntax ('``HWD``'). The ``HWD`` notation also defines some standard 
rules for visual representation of hardware elements in the browser UI 
and for the general flow of information between UI elements and 
hardware devices connected to the Raspi´s GPIO ports (or being emulated).

As soon as things get more complex, you will have to provide some Javascript
code (preferibly ES6 standard) to describe the logic of your application
(sitting on the server). If you want to customize the UI you can also add code 
and resource files to the client side.


## Documentation

After installation a detailed documentation for __berry-frame__ is available
under _(install_dir)/client/readme.html_.

The browser UI of a running _berry_ contains a link to the documentation.


## Examples

### The _Hello berry_

There is a demo website which shows a _berry_ called "Hello".
The _Hello berry_ consists of a LED and a push button. The LED
will be ON while you hold the button down and it will go OFF when you release it.
The _Hello berry_ is so simple that it only needs a hardware description file 
(``Hello.hwd``) and no additional Javascript code on the server or on the client.

Try the _Hello berry_: https://followthescore:9001

The web UI contains a link the HWD file so that you see what was needed
to build this _berry_.

### The _Dimmer berry_

A slightly more complex example is the _Dimmer berry_. It has a LED and
a push button. Holding the button down changes the brightness of the LED,
a short tap will toggle between OFF and the last brightness level; a double
tap will switch to maximum brightness immediately.

Try the _Dimmer berry_: https://followthescore:9005  

This time we needed to add our own server-side class ("Dimmer.js") which provides
the specific application logic. The UI has a link to show its source code.

### more examples

After installation of __berry-frame__ the subdirectory *sample_berries*
will contain some ZIP archives with more examples. Unpack a ZIP file
into the root of your project and start the _berry_ as described below.

	
## Installation

```
npm install berry-frame
```

After installing __berry-brame__ have a look into the documentation and follow
the setup steps described there.


## Starting a _berry_

Put the code below into a file named ``Berry.js``
```javascript
var berry-frame = new (require('berry-frame').BerryFrame)();

berry-frame.load();
```

Test your installation by calling ``node Berry``. You should see
some syntax help on how to start the server for a _berry_.

Then start the server for your _berry_ (e.g. the ``Hello`` _berry_):

``node Berry Hello -l1``

You may redirect stdout and stderr to files and probably you want to execute 
the server in the background (adding "&" under Unix or 
calling `` start node Berry Hello`` under _Windows_.

The parameter "-l1" sets the log level to "1" which will produce some
useful information in the server log about what is going on between the
server and the client(s). When you run your _berry_ in production you should
not use this option as it may slow down your application and as it may
produce a lot of output.


## License: ISC


## Author

Gero Scholz (gero.scholz@gmail.com)

Contact me if you want to contribute.
