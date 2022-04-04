# SRCDockS

Easy to use system that allows deduplicated hosting / management of Source Engine based game servers. Unlike other solutions, this one completely throws the idea of Docker and how a container should be static / unchangeable out of the window as you otherwise cannot really host gameservers in a good fashion.

This system consists of one Management (Watchdog) image and the server image itself.

## Watchdog (srcdocks:latest / srcdocks:watchdog)

The watchdogs purpose is to keep the local "repository" of the desired servers, as well as Meta- and SourceMod up to date.

#### Mounts:

1. `/repo` - The main directory where all servers will be downloaded / saved into to be made available for servers.

#### Env variables:

1. `SM_VERSION` - Major SourceMod version to maintain, currently defaults to 1.10 (Stable)
2. `MM_VERSION` - Major MetaMod version to maintain, currently defaults to 1.10 (Stable)
3. `KEEPCOUNT` - The amount of versions to store per server type
4. `APPS` - Which *server types* should be maintained

**APPS** should be a comma-seperated list of which server types (CS:GO, CS:S, TF2, ...) you want to run using the Server image. These are passed in the format of `server_folder_name:download_appid:version_appid`, so for CS:GO it is `csgo:740:730`. If `download_appid` and `version_appid` match you can omit `version_appid`.

**KEEPCOUNT** is used to keep a history of server files per server type. This should NOT be lower than 2. The versions themselves are de-duplicated themselves as well using Hardlinks, so only whatever changes between versions is used up as extra space.

## Server (srcdocks:server)

The server image makes use of the supplied server binaries of the watchdog. Its entrypoint makes sure to link to the latest version available on restart and uses the `-autoupdate` cmdline argument of SRCDS to automatically shut down (And thus switch to a possibly available update) whenever it is outdated.

The entire server structure is rebuilt on every restart, so any files actively written while the server is running will be deleted in this process. If your server is writing files which you need to keep (e.g. SourceMod logs) make sure to mount directories to the paths where the files in question are written (e.g. `/srcds/srv/csgo/addons/sourcemod/logs`)

#### Mounts:

1. `/repo` - The directory maintained by the Watchdog container. Can / Should be mounted as read-only
2. `/custom` - Custom files specific to this server
3. `/layers` - Custom layers unspecific to this server (Plugins that are reused, configs, ...)
4. `/overlays` - The function of overlays and how it differs from customs and layers is explained in detail below

#### Env variables:

1. `APP_NAME` - The name of the server type (e.g. `csgo`)
2. `SRCDS_ARGS` - cmdline arguments to pass to the server (e.g. `-tickrate 128 -nobots`)
3. `NO_BSP_CVAR` - If true (1) will delete the `bspconvar_whitelist.txt` file upon start which prevents maps from changing server cvars and removes a lot of verbose console spam.
4. `SRCDS_RUN` - If true (1) will use the `srcds_run` script instead of directly running the `srcds_linux` binary. I'm unsure if my implementation is going to break with some mod so I've added `srcds_run` as a fallback for now. Might be removed in the future.
5. `IP` - IP to bind the server to, defaults to 0.0.0.0
6. `PORT` - Port to bind the server to, defaults to 27015
7. `STOCK_SM_PLUGINS` - If not empty (Default) will delete all but the specified default plugins that ship with SourceMod. If you want to keep Basebans and Basecommands you would specify `basebans,basecommands`. If you want to delete all plugins just specify any non-empty value thats not the name of a default plugin.

IP / PORT are also what will be accessed to do the healthcheck. If you need to access a different IP/port for that you can override it with `HEALTH_IP` and `HEALTH_PORT` respectively

**ℹ Depending on how your network is set up, you might want to / have to use host networking instead of a bridge, for example when you're using a failover IP, as otherwise you're unable to bind to your failover IP, and with GSLT / the game coordinator that would mean players need to access your server trough your primary ip, not your failover IP**

### Layers (/layers/*)

Layers allow you to have various seperate additions to add to a server, like one folder to add a certain sourcemod plugin and whatever files it needs, another one to adds configs and so on. The advantage of a setup like this is that you can easily reuse things that you use on multiple servers without the need to explicitly copy them into the...

### Custom directory (/custom/*)

Like layers, everything in the custom directory is linked into the server on launch, but unlike layers files that are in this directory are meant to be ones that are specific to this server, like configurations that differ from one server to another, etc. Additionally, Custom files have priority over layers. So if a layer creates a certain file which also exists in the custom directory it will be overwritten.

**⚠️ Both the Custom directory and Layers take all the *files* and link them in the respective places at startup of the server, and while you can modify existing custom files while the server is running (And the changes are instantly applied since the files are symlinked) to add new files you need to restart the server and thus cause a rebuild**

### Overlays (/overlays/*)

Overlays are basically a combination and more powerful alterantive to the two prior features. Overlays are used to link entire folders into the server. One example for this would be if you want to have a shared folder of maps thats used across all servers. This would of course work using a layer since it would link all the maps into the server on start, but if you add a map afterwards it would not be available to the server, and if the server was to download a map at runtime, it would not make it to the host folder.

Another example would be having recorded demos actually save to the host folder instead of vanishing on server restart.


**⚠️ All of these are applied to the *base mod folder*, not the base server folder. So for CS:GO the files land in `/server/csgo`**

##### Example for a Layer:

You have a folder on your host with the structure `<layer folder>/addons/sourcemod/extensions/*`, `*` in that case being the extensions you want to be part of this layer. You would then mount `<layer folder>` into the server at `/layers/<any name>`.

##### Custom folder:

The structure of custom folders and layers is exactly the same, except that files that have been added by a layer can be overwritten by ones that possibly exist in a custom folder

##### Overlays:

Overlays function very similarly to the Custom folder and Layers, except the startup script of the server looks for any mountpoints in the Overlays folder and links those folders in place of what might already be there. So for an example, you could have a folder on your host called `workshopmaps` which you then mount to the server container at the path `/overlays/maps/workshop`. the host workshop maps folder is then linked in place of the `<mod>/maps/workshop` folder

### Extras

#### Healthcheck

The server image includes a docker healthcheck which sends [A2S_INFO](https://developer.valvesoftware.com/wiki/Server_queries#A2S_INFO) server queries to the server and checks if a valid response is received

#### Back-off restart

If the server crashes within 60 seconds of starting up it will keep increasing the delay between restarts up to 32 seconds to mitigate log-spam incase an update breaks something causing a bootloop. The restart delay will be reset to 1 second again once the server was able to be up for more than 60 seconds.
