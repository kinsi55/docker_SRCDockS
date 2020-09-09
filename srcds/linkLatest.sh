#!/bin/bash

# When you mount something to, say, /srcds/srv/csgo/addons/sourcemod/logs, -mount prevents the logs
# folder from being emptied as the bind-mound is a different "device" / filesystem
safeEmpty() {
	find $1 -mount -type f,s -delete
}

loadLatestVersion() {
	local latest=$(ls -td -- /repo/$APP_NAME/v_*/ | head -n 1)

	if [ $? -ne 0 ]
	then
		echo "No Serverfiles found. Looked for '/repo/$APP_NAME/v_*'"
		exit 1
	fi

	echo "Using Server files from '$latest'..."

	# Ensure we dont encounter a half-written version.
	# If the folder is newer than 6 seconds sleep a bit for good measure
	if test -z `find "$latest" -mmin -0.1`
	then
		sleep 3
	fi

	# Make sure to delete only symlinks, this way if e.g. the logs directory is bind-mounted
	# Files written to it will not be deleted as they're not symlinks but real files
	safeEmpty /srcds/srv/
	cp -rsf $latest* /srcds/srv/

	# While we're here we might as well create these files to prevent unnecessary console messages
	ln -sf /srcds/srv/bin/steamclient.so ~/.steam/sdk32/
	(cd /srcds/srv/$APP_NAME/ && touch cfg/default.cfg cfg/server.cfg cfg/gamemode_casual_server.cfg)

	if [[ $NO_BSP_CVAR == "1" ]]
	then
		rm /srcds/srv/$APP_NAME/bspconvar_whitelist.txt
	fi
}

loadCleanAddons() {
	safeEmpty /srcds/srv/$APP_NAME/addons/ 2> /dev/null

	cp -rsf /repo/mm/* /srcds/srv/$APP_NAME/
	cp -rsf /repo/sm/* /srcds/srv/$APP_NAME/
}

addCustomFiles() {
	echo "Adding custom layers..."
	cp -rsfv /layers/*/ /srcds/srv/$APP_NAME/ 2> /dev/null

	echo "Adding custom files..."
	cp -rsf /custom/* /srcds/srv/$APP_NAME/ 2> /dev/null
}

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

loadLatestVersion
loadCleanAddons
addCustomFiles

# while true
# do
# 	loadLatestVersion

# 	if [[ $SRCDS_RUN == "1" ]]
# 	then
# 		runServer #&
# 	else
# 		runServerCustom #&
# 	fi

# 	#child=$!
# 	#wait "$child"


# 	# if test $retval -eq 0 then
# 	# 	break; # if 0 is returned then just quit
# 	# fi
# 	# test $? -gt 128 && break;

# 	echo "Server exited, waiting a short moment before restarting..."

# 	sleep 5
# done