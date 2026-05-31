// @ts-check
import { spawn, execSync } from "child_process";
import fs from "fs";
import os from "os";
import chalk from "chalk";
import { t } from "../../i18n/index.js";

const isWindows = os.platform() === "win32";

/**
 * @returns {Promise<string|null>}
 */
export async function getVlcPath() {
	if (isWindows) {
		const commonPaths = [
			"C:\\Program Files\\VideoLAN\\VLC\\vlc.exe",
			"C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe"
		];

		for (const p of commonPaths) {
			if (fs.existsSync(p)) return p;
		}

		try {
			const result = execSync("where vlc").toString().trim().split("\n")[0];
			if (result && fs.existsSync(result)) return result;
		} catch (e) {}
	} else {
		try {
			const result = execSync("which vlc").toString().trim();
			if (result) return result;
		} catch (e) {}

		if (fs.existsSync("/usr/bin/vlc")) return "/usr/bin/vlc";
		if (fs.existsSync("/Applications/VLC.app/Contents/MacOS/VLC")) return "/Applications/VLC.app/Contents/MacOS/VLC";
	}

	return null;
}

/**
 * @returns {Promise<boolean>}
 */
export async function installVlc() {
	const platform = os.platform();

	if (platform === "win32") {
		console.log(chalk.cyan(t("errors.vlcNotFound", { manager: "Winget" })));
		try {
			execSync("winget install VideoLAN.VLC -e --source winget", { stdio: "inherit" });
			console.log(chalk.green(t("errors.vlcInstalled")));
			return true;
		} catch (error) {
			console.error(chalk.red(t("errors.vlcInstallFailed")));
			return false;
		}
	} else if (platform === "darwin") {
		console.log(chalk.cyan(t("errors.vlcNotFound", { manager: "Homebrew" })));
		try {
			execSync("brew install --cask vlc", { stdio: "inherit" });
			console.log(chalk.green(t("errors.vlcInstalled")));
			return true;
		} catch (error) {
			console.error(chalk.red(t("errors.vlcInstallFailed")));
			return false;
		}
	} else if (platform === "linux") {
		const managers = [
			{ cmd: "apt-get", install: "sudo apt-get update && sudo apt-get install vlc -y" },
			{ cmd: "dnf", install: "sudo dnf install vlc -y" },
			{ cmd: "pacman", install: "sudo pacman -S vlc --noconfirm" }
		];

		for (const mgr of managers) {
			try {
				execSync(`which ${mgr.cmd}`, { stdio: "ignore" });
				execSync(mgr.install, { stdio: "inherit" });
				console.log(chalk.green(t("errors.vlcInstalled")));
				return true;
			} catch (e) {
				continue;
			}
		}
		return false;
	}
	return false;
}

/**
 * @param {string} url
 * @param {object} [options]
 * @param {number} [options.startPosition] - VLC'de desteklenmiyor
 * @param {(position: number, duration: number) => void} [options.onClose] - VLC'de desteklenmiyor
 * @returns {Promise<number|void>}
 */
export async function openInVlc(url, options = {}) {
	let vlcPath = await getVlcPath();

	if (!vlcPath) {
		const installed = await installVlc();
		if (installed) {
			vlcPath = await getVlcPath();
		} else {
			throw new Error(t("errors.vlcNotFoundAndFailed"));
		}
	}

	if (!vlcPath) throw new Error(t("errors.vlcPathNotFound"));

	console.log(chalk.cyan(t("errors.vlcStarting")));

	return new Promise((resolve, reject) => {
		const child = spawn(vlcPath, ["--fullscreen", url], {
			stdio: "ignore"
		});

		child.on("error", (err) => reject(err));
		child.on("close", (code) => resolve(code));
	});
}
