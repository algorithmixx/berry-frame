@echo off

if exist log (
	rem directory already exists
) else (
	mkdir log
)
if exist log\old (
	rem directory already exists
) else (
	mkdir log\old
)

move log\*.log log\old
move log\*.err log\old

echo "starting monitor"
start node_modules\berry-frame\bin\monitor.bat 1>log\monitor.log 2>log\monitor.err
ping -n 3 127.0.0.1 > NUL

echo "starting Master .."
start node_modules\berry-frame\bin\berry.bat Master  1>log\Master.log 2>log\Master.err
ping -n 3 127.0.0.1 > NUL

for %%b in (%*) do (
	echo "starting %%b .."
	start node_modules\berry-frame\bin\berry.bat %%b 1>log\%%b.log 2>log\%%b.err
	ping -n 3 127.0.0.1 > NUL
)
