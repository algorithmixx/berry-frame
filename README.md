# berry-frame

A framework for building _Raspberry Pi applications_ with a web browser interface.

The applications you build with __berry-frame__ are called ___berries___.


## Introduction

If you write applications for small embedded computers like the _Raspberry Pi_
you will quickly notice that more than 70% of your program code does not really deal
with the application logic itself but with technical issues like accessing
a certain device or handling communication between your Raspi and a web client.

__berry-frame__ offers a way to separate all this generic technical stuff from the
core application logic. The framework has a _server part_ running under _node.js_ on the 
_Raspberry Pi_ and a _client part_ running within the _browser_. The server part
includes a http service listening at a configurable port. The server establishes
web socket connections to the clients and it also offers a REST-like API.

__berry-frame__ can be installed on a _Raspberry Pi_ and on other operating systems
like _Windows_. When installed on a platform which does not have GPIOs the server 
part will use some (minimalistic) emulation for missing hardware peripherals.
	
__berry-frame__ is not a "graphical tool for drawing your programming logic".

__berry-frame__ expects a structured description of your hardware peripherals 
in JSON-syntax ('``HWD``'). The ``HWD`` notation also defines some standard 
rules for _visual representation_ of hardware elements in the browser UI 
and for the general _flow of information_ between UI elements and 
hardware devices connected to the Raspi´s GPIO ports (or being emulated).

As soon as things get more complex, you will have to provide some Javascript
code (preferibly ES6 standard) to describe the logic of your application
(sitting on the server). If you want to customize the UI you can also add code 
and resource files to the client side.


## History

__berry-frame__ was written as a platform for teaching students the basics
of programming embedded systems. It was designed to hide a lot of technical 
issues so that the students could concentrate on the essentials of 
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
on client and server is an extra advantage.

Experts will understand that this approach is not suitable for
extremely time-critical tasks, for hard realtime requirements
and for cheap mass production (which even may use FPGAs these days ..). 
But it turns out that the overall performance and elegance of this
approach is often absolutely sufficient for building valuable 
real-world applications.


## Examples

### The _Hello berry_

There is a demo website which shows a _berry_ called "Hello".
The _Hello berry_ consists of a LED and a push button. The LED
will be ON while you hold the button down and it will go OFF when you release it.
The _Hello berry_ is so simple that it only needs a hardware description file 
(``Hello.hwd``) and no additional Javascript code on the server or on the client.

Try the _Hello berry_ : http://followthescore.org:9001

The web UI contains a link to the HWD file so that you can see what was needed
to build this _berry_.

### The _Dimmer berry_

A slightly more complex example is the _Dimmer berry_. It also consists of a LED and
a push button. Holding the button down, however, changes the brightness of the LED
continuously, a short tap will toggle between OFF and the last brightness level; 
a double tap will switch to maximum brightness immediately.

Try the _Dimmer berry_ : http://followthescore.org:9005  

This time we needed to add our own server-side class ("Dimmer.js") which provides
the specific application logic. The UI has a link to show its source code.

### More _berries_ in the shop ..

A collection of freely available _berries_ can be found under https://followthescore.org/berry

Once you have installed __berry-frame__ you can install a berry from the shop by
typing at the command line ``berry -i berryNameFromShop``.


## Installation

Change to the home directory of your project. We will call this directory
BERRY_HOME from now on.

In BERRY_HOME use ``npm`` to install __berry-frame__:

```
npm install berry-frame
```

If you are on _Windows_: Copy the script ``node_modules\berry-frame\bin\berry.bat`` 
to BERRY_HOME.

If you are on the _Raspberry Pi_: Copy `` node_modules/berry-frame/bin/berry``
to BERRY_HOME and make it executable. Also call ``sudo apt-get install libasound2-dev``
because its header file will be needed during the Raspi-specific second installation step.

Now call ``berry`` (or ``./berry`` on the Raspi) to check if the installation works.
You should see a _syntax help_ on how to start a _berry_.
On the Raspi the _very first call_ will load additional hardware specific modules via ``npm``
to complete the installation. Be patient, this will take some time. If you then call
``./berry`` a second time it will show only the syntax help and it will complain about
a missing argument (the type of the _berry_ to start).

Instead of using the ``berry`` script you can also write a file named ``Berry.js``
with the following code:
```javascript
require('berry-frame');
```
In that case you would call __berry-frame__ via ``node Berry (args...)`` and you can
add your own code before the ``require`` statement.


Depending on the degree of automation you want, some more steps may be desirable to ..
+ .. start __berry-frame__ and your _berry_ directly after the Raspberry Pi has booted,
+ .. start a watch dog process (monitor) which will restart your _berry_ if something went wrong 
+ .. start a _Master berry_ which registers running _berries_ and facilitates interaction between them
+ .. start a background process which will reconnect WiFi in case the connection was lost

The online manual will tell you how to do this. For the moment we skip these steps.


## Install a sample _berry_

Call ``berry -i Hello`` or unzip ``node_modules/berry-frame/sample berries/Hello.zip``
into BERRY_HOME.

The directory tree of a typical installation will then look like this:

````
(development root)
    berry                       (Unix, executable)
    berry.bat                   (Windows)
    node_modules
        ...                     (other modules)
        berry-frame             (the __berry-frame__ module)
            ...                 (.. with all its files)
        ...                     (other modules)
    package-lock.json
    log
        ...                     (log files for running berries and monitor) 
    Hello                       (your _berry_)
        audio                   (media resources for client and server)
        img                     (images for the web client)
        server                  (server resources of your _berry_)
            Hello.hwd           (JSON hardware description of your _berry_)
            Hello.js            (optional javascript source for your _berry_)
````

## Starting a _berry_

Now let us start the server for the _Hello berry_ like this:

``./berry Hello > Hello/Hello.log 2>Hello/Hello.err &``
or
``./berry Hello -l1``

The first call is for production use of your _berry_. 
It redirects stdout and stderr to files and executes the server 
in the background (under _Windows_ you would use ``start berry Hello ...``).

The second call is for development and testing; it adds a parameter "l" 
with the value 1, which increases the _log_ level to show more details about
the communication that will be happening between server and client(s).
When you run your _berry_ in production you should avoid this option 
as it may slow down your application and will potentially produce a lot of output.

Open the browser on your machine with ``http://localhost:9001`` and you should
see the web user interface.


## Online Manual

The Online Manual contains more details about __berry-frame__ and some hints
on how to design your own _berries_.

To access the online manual click on the red raspberry icon in the 
top left corner of the web UI.

The manual is written in markdown syntax and can be found under
``node_modules/berry-frame/client/readme.html``.


## License: ISC


## Author

Gero Scholz (gero.scholz@gmail.com)

Contact me if you want to contribute.
