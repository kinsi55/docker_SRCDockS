#!/bin/bash

ip=${HEALTH_IP-${IP-$(hostname)}}
port=${HEALTH_PORT-${PORT-27015}}

# Stupid syntax because using $() resulted in a bash warning because of the nullbyte
printf '\xff\xff\xff\xffTSource Engine Query\0' | nc -u -w 1 $ip $port | {
	read res

	if [[ ${res:4:1} != "I" ]]
	then
		exit 1
	fi

	echo ${res:6}
}