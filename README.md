# SRCDockS (❗ Experimental / WIP ❗)

Easy to use system that allows deduplicated hosting / management of Source Engine based game servers. Unlike other solutions, this one completely throws the idea of Docker and how a container should be static / unchangeable out of the window as you otherwise cannot really host gameservers in a good fashion.

This system consists of one Management (Watchdog) image and the server image itself.

## Watchdog

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

## Server

The server image makes use of the supplied server binaries of the watchdog. Its entrypoint makes sure to link to the latest version available on restart and uses the `-autoupdate` cmdline argument of SRCDS to automatically shut down (And thus switch to a possibly available update) whenever it is outdated.

The entire server structure is rebuilt on every restart, so any files actively written while the server is running will be deleted in this process. If your server is writing files which you need to keep (e.g. SourceMod logs) make sure to mount directories to the paths where the files in question are written (e.g. `/srcds/srv/csgo/addons/sourcemod/logs`)

#### Mounts:

1. `/repo` - The directory maintained by the Watchdog container. Can / Should be mounted as read-only
2. `/custom` - Custom files specific to this server
3. `/layers` - Custom layers unspecific to this server

#### Env variables:

1. `APP_NAME` - The name of the server type (e.g. `csgo`)
2. `SRCDS_ARGS` - cmdline arguments to pass to the server (e.g. `-tickrate 128 -nobots`)
3. `NO_BSP_CVAR` - If true (1) will delete the `bspconvar_whitelist.txt` file upon start which prevents maps from changing server cvars and removes a lot of verbose console spam.
4. `SRCDS_RUN` - If true (1) will use the `srcds_run` script instead of directly running the `srcds_linux` binary. I'm unsure if my implementation is going to break with some mod so I've added `srcds_run` as a fallback for now. Might be removed in the future.

### Layers (/layers/*)

Layers allow you to have various seperate additions to add to a server, like one folder to add a certain sourcemod plugin and whatever files it needs, another one to adds configs and so on. The advantage of a setup like this is that you can easily reuse things that you use on multiple servers without the need to explicitly copy them into the...

### Custom directory (/custom/*)

Like layers, everything in the custom directory is linked into the server on launch, but unlike layers files that are in this directory are meant to be ones that are specific to this server, like configurations that differ from one server to another, etc. Additionally, Custom files have priority over layers. So if a layer creates a certain file which also exists in the custom directory it will be overwritten.

**⚠️ Both Layers and custom files are applied to the *base mod folder*, not the base server folder. So for CS:GO the files land in `/server/csgo`**

**⚠️ While you can modify existing custom files while the server is running (And the changes are instantly applied since the files are symlinked) to add new files you need to restart the server and thus cause a rebuild**

##### Example for a Layer:

Base Folder: `/layers/steamworks`, contains its extension files in the respective directory structure `addons/sourcemod/extensions/*`

##### Custom folder:

Everything in it is linked into the mod directory in the same fashion as layers are

### Extras

#### Healthcheck

The server image includes a docker healthcheck which sends [A2S_INFO](https://developer.valvesoftware.com/wiki/Server_queries#A2S_INFO) server queries to the server and checks if a valid response is received

#### Back-off restart

If the server crashes within 60 seconds of starting up it will keep increasing the delay between restarts up to 32 seconds to mitigate log-spam incase an update breaks something causing a bootloop. The restart delay will be reset to 1 second again once the server was able to be up for more than 60 seconds.