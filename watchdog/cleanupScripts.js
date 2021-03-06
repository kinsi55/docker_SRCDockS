module.exports = {
	csgo: [
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
	]
};