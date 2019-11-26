
if exist log (
	rem directory already exists
) else (
	mkdir log
)

# start the monitoring script
if exist log\monitor.err ( 
	move log\monitor.err log\monitor.err.old
)
if exist log\monitor.log ( 
	move log\monitor.log log\monitor.log.old
)
start berry /bin/monitor 1>monitor.log 2>monitor.err &
ping -n 3 127.0.0.1 > NUL

# start Master
if test -e Master.err ; then mv -f Master.err Master.err.old; fi
if test -e Master.log ; then mv -f Master.log Master.log.old; fi
berry/bin/berry Master  1>Master.log 2>Master.err &
ping -n 3 127.0.0.1 > NUL

for berry in $*
do
	echo "starting $berry .."
	# start $berry
	if test -e $berry/$berry.err ; then mv -f $berry/$berry.err $berry/$berry.err.old; fi
	if test -e $berry/$berry.log ; then mv -f $berry/$berry.log $berry/$berry.log.old; fi
	berry/bin/berry $berry 1>$berry/$berry.log 2>$berry/$berry.err &
	ping -n 3 127.0.0.1 > NUL
done
