@echo off

echo Starting an endless loop: Wait for a file named 'restart.cmd' and execute it ..

echo -----------------------------------------------------------
echo this script must be started from your 'berries' directory !
echo -----------------------------------------------------------

:loop
	sleep 5
	if exist restart.cmd goto restart
	goto loop

:restart
	echo restarting ..
	date /t
	time /t
	call start restart.cmd
	sleep 5
	del restart.cmd
	goto loop
