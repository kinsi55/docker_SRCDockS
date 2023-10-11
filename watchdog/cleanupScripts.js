const fs = require("fs");

module.exports = {
	740: [
		// Delete Windows / 64bit files
		"rm -r steamapps srcds.exe chrome.pak",
		"find . -name '*.dll' -type f,l -delete",

		"find . -path '*linux64*' -type d -prune -exec rm -r '{}' \\;",

		// Client files obviously are only needed on the client
		"find . -name '*_client.so' -type f,l -delete",

		// Unnecessary platform files
		"find platform/* -maxdepth 0 -type d -prune -exec rm -r '{}' \\;",
		"find platform/* -not -name '*_dir.vpk' -type f,l -delete",
		// Delete platform paks entirely (Saves 1gb, shaders, prevents sv_pure on them)
		// "rm -r ./platform",

		// China / low violence Paks, no need
		`find csgo/* -name 'pakxv*.vpk' -type f,l -delete`,

		// Unnecessary configs
		`find csgo/cfg/ -not -name 'gamemode_*.cfg' -not -name 'valve.rc' -not -name 'cpu_level_2*' -not -name 'mem_level_2*' -type f,l -delete`,

		// - Panorama UI stuff, only needed on the client
		// - Resources are unused on the server, altho you could possibly add custom radars etc.
		// - Expressions is some L4D2 stuff lol
		`rm -r csgo/panorama csgo/resource csgo/expressions`,

		`find csgo/scenes/* -not -name 'scenes.image' -type f,l -delete`,

		// I think the soundcache isnt needed on the server either?
		`rm -r csgo/maps/soundcache`,

		// Defaultmap images are not needed on the server, neither are stories
		`find csgo/maps/* -name '*.jpg' -type f,l -delete`,
		`find csgo/maps/* -name '*.txt' -not -name '*_cameras.txt' -type f,l -delete`,

		// By defaults the models folder doesnt contain anything useful to the server as they're in paks
		`rm -rf csgo/models/*`,

		// These files arent really big but theres many of them
		"rm -rf bin/v8_winxp bin/prefabs bin/locales",
		`rm -rf csgo/scripts/hammer`,
		`rm -rf csgo/materials/panorama`
	],
	730: [
		// THEY INCLUDE BUILDCHAIN STUFF IN THE RELEASE. 8000 FILES
		`rm -rf sniper_*`,
		`rm -rf pressure-vessel`,

		// Dont need low violence paks
		`rm -rf game/csgo_lv`,

		// Dont need Vulkan Shaders
		`rm -rf game/csgo/shaders_.vpk`,

		// Dont need tools.
		`rm -rf game/core/tools`,

		// - Panorama UI stuff, only needed on the client
		// - Resources are unused on the server, altho you could possibly add custom radars etc.
		`rm -r game/csgo/panorama game/csgo/resource`,

		// We are downloading the CS2 client, not server (Which doesnt exist because reasons (Yet ™)) so
		// to streamline things we restructure this client to look like a srcds server.......... kind of

		//`ln -s game/csgo/ cs2cl`,

		(path) => fs.writeFileSync(`${path}/srcds_run`,
`#!/bin/sh
# Yep, that's me. You're probably wondering how I got into this situation ...

game/bin/linuxsteamrt64/cs2 -dedicated $@`),

		`chmod +x srcds_run`,

		// I dont even care at this point
		`cp /steamcmd/linux64/steamclient.so ./`
	]
};