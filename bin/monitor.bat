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
	sleep 3
	type restart.cmd
	sleep 1
	call start restart.cmd
	sleep 5
	del restart.cmd
	goto loop
