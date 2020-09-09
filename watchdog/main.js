//const Docker = require('dockerode');
//const docker = new Docker({socketPath: '/var/run/docker.sock'});

const fs = require("fs");
const fetch = require("node-fetch");
const {spawn, execSync, exec} = require("child_process");
const execP = (require("util")).promisify(exec);

const repoDir = "/repo";
const updateCheckUrl = "http://api.steampowered.com/ISteamApps/UpToDateCheck/v0001?version=1&format=json&appid=";

// Docker Graceful shutdown
process.on("SIGTERM", () => {
  process.exit(0);
});

const cleanupScripts = require("./cleanupScripts");

function getPatchVersionFromIni(iniContent) {
	const match = /PatchVersion=([0-9.]+)/.exec(iniContent)

	if(match && match[1])
		return match[1].replace(/[^0-9]/g, "");
}

function getInstalledVersion(path = `${basedir}/latest/${appStuff.name}/steam.inf`) {
	try {
		return getPatchVersionFromIni(fs.readFileSync(path))
	} catch(ex) {
		if(ex.code !== "ENOENT")
			throw ex;
	}

	return 0;
}

class AppManager {
	/**
	 *Creates an instance of AppManager.
	 * @param {{name: string, downloadId: string, versionId: string}} app
	 * @memberof AppManager
	 */
	constructor(app) {
		this.app = app;
		this.checkInstalledVersion();
	}

	checkInstalledVersion() {
		this.latestVersion = getInstalledVersion(`${repoDir}/${this.app.name}/latest/${this.app.name}/steam.inf`);
	}

	async updateCheck() {
		try {
			const latestVersion = await this.getLatestVersion();

			if(latestVersion > this.latestVersion) {
				console.log("Update detected for Appid %s(%s): %s => %s", this.app.downloadId, this.app.name, this.latestVersion, latestVersion);

				downloadManager.enqueueUpdate(this, latestVersion);

				this.latestVersion = latestVersion;
			}
		} catch(ex) {
			console.log("Failed to check for update of %s:", this.app.name, ex);
			//throw ex;
		}
	}

	getLatestVersion() {
		return fetch(`${updateCheckUrl}${this.app.versionId}`)
			.then(res => res.json())
			.then(json => json.response.required_version);
	}
}

/** @type {AppManager[]} */
const apps =
	(process.env.APPS || "csgo:740:730")
		.split(",")
		.map(section => {
			const [name, downloadId, versionId] = section.split(":");

			return new AppManager({
				name,
				downloadId,
				versionId: versionId || downloadId
			});
		});

let lastGameUpdate = Date.now();

//const basedir = `${repoDir}/${appStuff.name}`;

const downloadManager = new (class {
	constructor() {
		/** @type {{manager: AppManager, version: string}[]} */
		this.tasks = [];
	}

	/**
	 *
	 *
	 * @param {AppManager} manager
	 * @param {*} version
	 * @returns
	 */
	enqueueUpdate(manager, version) {
		// We're already downloading this.
		if(this.tasks.some(x => x.version == version || x.manager == appManager))
			return false;

		const installedVersion = getInstalledVersion(`${repoDir}/${manager.app.name}/latest/${manager.app.name}/steam.inf`);

		if(installedVersion >= version) {
			console.warn("We were supposed to update app %s to version %s but we already have %s installed, ignoring...", manager.app.name, version, installedVersion);
			return;
		}

		console.log("Enqueued download of AppID %s", manager.app.downloadId);

		this.tasks.push({manager, version});

		// If we just added the first task in a queue there isnt anyone left that would "resume" work
		if(this.tasks.length === 1)
			this.work();
	}

	async work() {
		if(!this.tasks.length)
			return;

		const {manager} = this.tasks[0];

		try {
			await this.downloadApp(`${repoDir}/${manager.app.name}`, manager.app);

			this.tasks.shift();

			manager.checkInstalledVersion();
		} catch(ex) {
			console.error("Failed to update / download %s, retrying later...", manager.app.name, ex);
			// We'll retry this later
			this.tasks.push(this.tasks.shift());
		}
		setTimeout(() => {
			this.work();
		}, 1000);
	}

	async downloadApp(appBaseDir, {downloadId, name}) {
		//Make sure theres actually something to download
		console.log("Downloading app %s...", name);

		// Prepare downloading directory

		//if(fs.existsSync(curVersionDir))
		//	execSync(`rm -rf ${curVersionDir}`);

		//IF there is a previous version, now is the time to link it, otherwise create the new dir
		//execSync(`cp -rl $(ls -td -- v_*/ | head -n 1) ${curVersionDir} || mkdir ${curVersionDir}`);

		/*
		Start updating the downloading folder, steamcmd will follow the symlinks and if it needs to
		update one of the files delete it (In which case it deletes the symlink) then download
		said file in place of the symlink
		*/
		await new Promise((res, rej) => {
			const proc = spawn("/steamcmd/steamcmd.sh", [
				"+@ShutdownOnFailedCommand", "1",
				"+@NoPromptForPassword", "1",
				"+@bMetricsEnabled", "0",
				//"+@nCSClientRateLimitKbps", "0",
				"+login", "anonymous",
				"+force_install_dir", `${appBaseDir}/latest`,
				"+app_update", downloadId, "validate",
				"+quit"
			]);

			let finished = false;

			const timeout = setTimeout(() => {
				rej();
				proc.kill("SIGKILL");
			}, 1000*60*15);

			proc.stdout.setEncoding("utf-8");
			proc.stdout.on("data", (data) => {
				//for(let x of data.toString("utf8").split("\n"))
					console.info(`[SteamCMD - ${downloadId}] ${data}`);

				if(data.includes(`Success! App '${downloadId}' fully installed.`))
					finished = true;
			});

			proc.on("exit", () => {
				clearTimeout(timeout);
				if(!finished)
					return rej();

				res();
			});
		});

		let oldVersion;

		try {
			oldVersion = execSync(`set -o pipefail; ls -td -- ${appBaseDir}/v_*/ | head -n 1`, {
				shell: "/bin/bash",
				encoding: "utf8"
			});

			oldVersion = /(.+?)\n/.exec(oldVersion)[1];
		} catch {}

		// console.log("Changed files: ", changedFiles);

		const installedVersion = getInstalledVersion(`${appBaseDir}/latest/${name}/steam.inf`);
		const curVersionDir = `${appBaseDir}/v_${installedVersion}`

		execSync(`mkdir -p ${curVersionDir}`);
		execSync(`rm -rf ${curVersionDir}/* || true`);
		execSync(`cp -rl ${appBaseDir}/latest/* ${curVersionDir}`);

		lastGameUpdate = Date.now();

		const tasks = cleanupScripts[name];

		if(tasks) {
			console.log("Running cleanup script...");
			for(let task of tasks)
				execSync(`${task} || true`, {cwd: curVersionDir});
			console.log("Cleanup done!");
		}

		// If there was a previous version build a difflist
		if(oldVersion) {
			// console.log("Executed:",
			// 	`rsync --dry-run --del --recursive -not -name 'DIFF.txt' --out-format=\\>\\>\\>\\ %n ${curVersionDir}/ ${appBaseDir}/${oldVersion} | ` +
			// 	`grep -i '\\(>>>\\|deleting\\) .*[^/]' | ` +
			// 	`sed 's#^\\(>>>\\|deleting\\) ##' > ` +
			// 	`${curVersionDir}/DIFF.txt`
			// );

			execSync(
				`rsync --dry-run --del --recursive --out-format=\\>\\>\\>\\ %n ${curVersionDir}/ ${oldVersion} | ` +
				`grep -i '\\(>>>\\|deleting\\) .*[^/]' | ` +
				`sed 's#^\\(>>>\\|deleting\\) ##' > ` +
				`${curVersionDir}/DIFF.txt`
			);
		}

		// Only keep the latest N versions stored
		execSync(`rm $(ls -td ${appBaseDir}/v_*/ | tail -n+${(parseInt(process.env.KEEPCOUNT) || 3) + 1}) 2> /dev/null || true`);
	}
})

function checkAppUpdates() {
	for(let app of apps)
		app.updateCheck();
}

setInterval(checkAppUpdates, 1000 * 60);
checkAppUpdates();



const addons = {
	latestMM: fs.existsSync("/repo/mm/version") ? fs.readFileSync("/repo/mm/version") : "",
	latestSM: fs.existsSync("/repo/sm/version") ? fs.readFileSync("/repo/sm/version") : ""
};

const baseUrlMM = `https://mms.alliedmods.net/mmsdrop/${process.env.MM_VERSION || "1.10"}`
const baseUrlSM = `https://sm.alliedmods.net/smdrop/${process.env.SM_VERSION || "1.10"}`

async function checkAddonUpdates(initial) {
	// Check for addon updates up to 2 days after a game update
	let doCheck = initial || (Date.now() - lastGameUpdate < 1000 * 60 * 60 * 24 * 2);

	if(!doCheck) {
		// Check if SM / MM even exist at all, if not we should download latest ofc.
		const dirEmpty = (dir) => !fs.existsSync(dir) || !fs.readdirSync(dir).length;
		doCheck = dirEmpty("/repo/sm/") || dirEmpty("/repo/mm/");

		if(!doCheck)
			return;
	}

	execSync("mkdir -p /repo/sm/ /repo/mm/");

	const [latestMM, latestSM] = await Promise.all([
		fetch(`${baseUrlMM}/mmsource-latest-linux`).then(x => x.text()),
		fetch(`${baseUrlSM}/sourcemod-latest-linux`).then(x => x.text())
	]);

	async function dl(whatShort, base, path) {
		execSync(`rm -rf /tmp/${whatShort} || true`);

		await execP(`set -o pipefail; curl -s "${base}/${path}" | tar xz -C /tmp --one-top-level=${whatShort}`, {shell: "/bin/bash"})

		await execP(`rm -rf /repo/${whatShort}/* || true`);
		await execP(`mv /tmp/${whatShort}/* /repo/${whatShort}/`);
	}

	if(latestMM != addons.latestMM) {
		dl("mm", baseUrlMM, latestMM).then(() => {
			addons.latestMM = latestMM;
			console.log("Updated Metamod to `%s`", latestMM);
			fs.writeFileSync("/repo/mm/version", latestMM);
		}).catch((err) => {
			console.error("Failed to Update / Download Metamod!", err);
		});
	}

	if(latestSM != addons.latestSM) {
		dl("sm", baseUrlSM, latestSM).then(() => {
			addons.latestSM = latestSM;
			// Scripting folder isnt needed on the server
			execSync("rm -rf /repo/sm/addons/sourcemod/scripting || true");

			console.log("Updated Sourcemod to `%s`", latestSM);
			fs.writeFileSync("/repo/sm/version", latestSM);
		}).catch((err) => {
			console.error("Failed to Update / Download Sourcemod!", err);
		});
	}
}

setInterval(checkAddonUpdates, 1000 * 60 * 10);
checkAddonUpdates(true);

/*
	This system was initially supposed to rebuild a server image and re-create server containers
	using the new image... Until I realized how much of an overhead that is and how its possible in
	a (IMO) better fashion (this)
*/

// (async() => {


// 	docker.listContainers({
// 		all: true,
// 		/*filters: [
// 			{
// 				ancestor: `srcds-${appId}:latest` //?
// 			}
// 		]*/
// 	}, async(err, containers) => {
// 		if(err)
// 			return;

// 		for(let container of containers) {
// 			if(container.Names.some(name => name === "/CLONEME")) {
// 				/** @type {Dockerode.ContainerInspectInfo} */
// 				const inspect = await docker.getContainer(container.Id).inspect();

// 				const cloneCfg = {
// 					...inspect.Config,
// 					name: inspect.Name + "-CLONE",
// 					HostConfig: inspect.HostConfig
// 				};

// 				//delete cloneCfg.Hostname;

// 				//await docker.createContainer(cloneCfg);

// 				// console.log(await (new SrcdsContainer(container.Id)).iniVersion());

// 				//console.log(JSON.stringify(inspect, null, 2));

// 				break;
// 			}
// 		}
// 	});
// })();