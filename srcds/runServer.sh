#!/bin/bash

runServerCustom() {
	export LD_LIBRARY_PATH="/srcds/srv:/srcds/srv/bin"
	./srcds_linux -game $APP_NAME $SRCDS_ARGS -strictportbind -port ${PORT-27015} -ip ${IP-0.0.0.0} -autoupdate -nobreakpad
}

runServer() {
	# The order is IMPORTANT. -autoupdate enables auto-restart,
	# but -norestart removes it again, keeping autoupdate active but using my autorestart instead
	/bin/bash srcds_run $SRCDS_ARGS -strictportbind -port ${PORT-27015} -ip ${IP-0.0.0.0} -autoupdate -norestart -nobreakpad
}

cd /srcds/srv

if [[ $SRCDS_RUN == "1" || $APP_NAME == "cs2cl" ]]
then
	runServer
else
	runServerCustom
fi