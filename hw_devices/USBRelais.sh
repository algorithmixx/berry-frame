#!/bin/bash
# switch <relaisNr> <cmd>
# <relaisNr>  = 1 .. 8  or 0 (all relays)
# <cmd>     = 0 (off) or 1 (on)

DEVICE="/dev/ttyACM0"
stty -F $DEVICE 9600 -icanon
if [ "$1" = "0" ]; then
    echo -n -e "\xff\x01\x0${2}" > $DEVICE
    echo -n -e "\xff\x02\x0${2}" > $DEVICE
    echo -n -e "\xff\x03\x0${2}" > $DEVICE
    echo -n -e "\xff\x04\x0${2}" > $DEVICE
    echo -n -e "\xff\x05\x0${2}" > $DEVICE
    echo -n -e "\xff\x06\x0${2}" > $DEVICE
    echo -n -e "\xff\x07\x0${2}" > $DEVICE
    echo -n -e "\xff\x08\x0${2}" > $DEVICE
else
    echo -n -e "\xff\x0${1}\x0${2}" > $DEVICE
fi

# exit 0

echo "switched relais nr $1 to state $2, checking state:"

# set up tty listener
# cat < $DEVICE > relaystate.bin &
cat < $DEVICE &
bgPid=$!
# send status query
echo -e -n '\xff\x0${1}\x03' > $DEVICE
# wait for response from relay board, the stop listener
sleep 2
kill $bgPid
echo "killing" $bgPid
xxd relaystate.bin

