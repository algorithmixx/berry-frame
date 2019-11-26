start node_modules\berry-frame\bin\monitor
ping -n 3 127.0.0.1 > NUL
start node_modules\berry-frame\bin\master
ping -n 3 127.0.0.1 > NUL
start node_modules\berry-frame\bin\berry %*
