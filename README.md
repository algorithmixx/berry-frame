# berry-frame

A framework for building _Raspberry Pi applications_ with a web browser interface.

The applications you build with __berry-frame__ are called ___berries___.


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


## History

__berry-frame__ was written as a platform for teaching students the basics
of programming embedded systems. It was designed to hide a lot of technical 
issues so that the students can concentrate on the essentials of 
application development.

The traditional way of embedded systems development with languages
like C (possibly C++), snippets of assembler code and maybe even
with in-circuit emulators is quite hard. Especially when it comes to
display control a lot of boring yet necessary code has to be written.

Why not use a generic (touch) screen and let the browser do the rendering 
work? Or just have NO local screen hardware at all? If we can 
manage a good connection to a mobile device this could be
not only sufficient but also attractive to the user!

The Raspi offers a powerful and cheap platform with enough resources
for interpreted languages and their needs of memory and CPU power.
A Raspi can easily control GPIO hardware (SPI, I²C), handle a web server,
run the application and run a browser (for a local UI) at the same time.

With the availability of drivers for GPIO access in Javascript it 
became possible to combine hardware access, application logic and 
a web front end more elegantly than ever. Using the same language
on client and server is another advantage.

Experts will understand that this approach is not suitable for
extremely time-critical tasks, for hard realtime requirements
and for cheap mass production (which even may use FPGAs these days ..). 
But it turns out that the overall performance and elegance of this
approach is sufficient for building valuable real-world applications.


## Examples

### The _Hello berry_

There is a demo website which shows a _berry_ called "Hello".
The _Hello berry_ consists of a LED and a push button. The LED
will be ON while you hold the button down and it will go OFF when you release it.
The _Hello berry_ is so simple that it only needs a hardware description file 
(``Hello.hwd``) and no additional Javascript code on the server or on the client.

Try the _Hello berry_ : http://followthescore.org:9001

The web UI contains a link the HWD file so that you see what was needed
to build this _berry_.

### The _Dimmer berry_

A slightly more complex example is the _Dimmer berry_. It also has a LED and
a push button. Holding the button down, however, changes the brightness of the LED,
a short tap will toggle between OFF and the last brightness level; a double
tap will switch to maximum brightness immediately.

Try the _Dimmer berry_ : http://followthescore.org:9005  

This time we needed to add our own server-side class ("Dimmer.js") which provides
the specific application logic. The UI has a link to show its source code.

	
## Installation

```
npm install berry-frame
```

Optionally you can create a file (suggested name: ``Berry.js``) which contains
the following code:
```javascript
require('berry-frame');
```

Now unzip one or more of the _sample berries_ into your development root, 
which have been delivered together with __berry_frame__,
e.g. ``node_modules/berry-frame/sample_berries/Hello.zip``. Now you should
have a directory named ``Hello`` in your development root.

Depending on the degree of automation you want, some more steps may be necessary
+ start __berry-frame__ directly after your Raspberry PI has booted,
+ start a watch dog process (monitor) 
+ start a _Master berry_ which registers running _berries_ and facilitates interaction between them
The online manual will tell you how to do this.

Test your installation by calling ``node Berry`` (if you wrote your own ``Berry.js``).
You should see some _syntax help_ on how to start the server for a _berry_.

As an alternative, you can also call ``node node_modules/berry-frame/Berry``.
In that case you do not need to write your own ``Berry.js`` file.
 
Or you call ``node_modules/berry-frame/bin/berry`` which is one-liner script
to invoke _node_ in the way described above.

We recommend to copy (or link) that script (``berry`` or ``berry.bat`` under ``Windows``)
to your development root.

The directory tree of a typical installation will then look like this:

````
(development root)
    berry						(Unix)
    berry.bat 					(Windows)
    log
        Master.log              (log file for Master)
        Master.err              (error file for Master)
        monitor.log             (log file for the monitor)
        monitor.err             (error file for the monitor)
    node_modules
        ...
        berry-frame
            ...		
    YourBerry
        audio               (media resources for client and server)
        img                 (images for the web client)
        server
            YourBerry.hwd   (JSON hardware description of your berry)
            YourBerry.js    (javascript source for your berry)
            YourBerry.log   (log file for YourBerry)
            YourBerry.err   (error file for YourBerry)
````

## Starting a _berry_

Assuming that you copied the small ``berry`` script to your development root,
you can start the server for your _berry_ (e.g. the ``Hello`` _berry_) like this:

``berry Hello > Hello/Hello.log 2>Hello/Hello.err &``
or
``berry Hello -l1``

The first call is for production use of your _berry_. 
It redirects stdout and stderr to files and executes the server 
in the background (under _Windows_ you would use ``start berry Hello ...``).

The second call is for development and testing; it adds a parameter "l" 
with the value 1, which increases the _log_ level to show more details about
the communication that will be happening between server and client(s).
When you run your _berry_ in production you should avoid this option 
as it may slow down your application and will potentially produce a lot of output.


## Online Manual

The Online Manual contains more information on __berry-frame__ and hints
on how to design your own _berries_.

To access the online manual start a _berry_ and then click in the browser
on the red raspberry icon in the top left corner.

The manual is written in markdown syntax and can be found under
_berry-frame/client/readme.html_


## License: ISC


## Author

Gero Scholz (gero.scholz@gmail.com)

Contact me if you want to contribute.
