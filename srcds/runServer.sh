#!/bin/bash

runServerCustom() {
	export LD_LIBRARY_PATH="/srcds/srv:/srcds/srv/bin"
	./srcds_linux -game $APP_NAME +map de_dust2 $SRCDS_ARGS -strictportbind -ip 0.0.0.0 -autoupdate -nobreakpad
}

runServer() {
	# The order is IMPORTANT. -autoupdate enables auto-restart,
	# but -norestart removes it again, keeping autoupdate active but using my autorestart instead
	/bin/bash srcds_run $SRCDS_ARGS -strictportbind -ip 0.0.0.0 -autoupdate -norestart -nobreakpad
}

cd /srcds/srv

if [[ $SRCDS_RUN == "1" ]]
then
	runServer
else
	runServerCustom
fi