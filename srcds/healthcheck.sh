#!/bin/bash

# Stupid syntax because using $() resulted in a bash warning because of the nullbyte
printf '\xff\xff\xff\xffTSource Engine Query\0' | nc -u -w 1 $(hostname) 27015 | {
	read res

	if [[ ${res:4:1} != "I" ]]
	then
		exit 1
	fi

	echo ${res:6}
}