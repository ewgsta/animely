// @ts-check
import { spawn, execSync } from "child_process";
import fs from "fs";
import os from "os";
import chalk from "chalk";

const isWindows = os.platform() === "win32";

/**
 * Checks if MPV is installed/available in PATH or common locations
 * @returns {Promise<string|null>} Path to MPV executable or null
 */
export async function getMpvPath() {
	if (isWindows) {
		const commonPaths = [
			"C:\\Program Files\\MPV\\mpv.exe",
			"C:\\Program Files (x86)\\MPV\\mpv.exe",
			"C:\\ProgramData\\chocolatey\\bin\\mpv.exe"
		];

		for (const p of commonPaths) {
			if (fs.existsSync(p)) return p;
		}

		try {
			// bakiom
			const result = execSync("where mpv").toString().trim().split("\n")[0];
			if (result && fs.existsSync(result)) return result;
		} catch (e) {
			// bulamadım
		}
	} else {
		try {
			const result = execSync("which mpv").toString().trim();
			if (result) return result;
		} catch (e) {
			// bulamadım
		}

		if (fs.existsSync("/usr/bin/mpv")) return "/usr/bin/mpv";
		if (fs.existsSync("/usr/local/bin/mpv")) return "/usr/local/bin/mpv";
		if (fs.existsSync("/opt/homebrew/bin/mpv")) return "/opt/homebrew/bin/mpv";
	}

	return null;
}

/**
 * Tries to install MPV using package managers
 * @returns {Promise<boolean>}
 */
export async function installMpv() {
	const platform = os.platform();

	if (platform === "win32") {
		console.log(chalk.cyan("mpv player bulunamadi. winget ile kurulmaya calisiliyor..."));
		try {
			execSync("winget install io.mpv.mpv -e --source winget", { stdio: "inherit" });
			console.log(chalk.green("mpv basariyla kuruldu!"));
			return true;
		} catch (error) {
			console.error(chalk.red("mpv kurulumu basarisiz oldu. lutfen manuel olarak kurunuz: https://mpv.io/installation/"));
			return false;
		}
	} else if (platform === "darwin") {
		console.log(chalk.cyan("mpv player bulunamadi. homebrew ile kurulmaya calisiliyor..."));
		try {
			execSync("brew install mpv", { stdio: "inherit" });
			console.log(chalk.green("mpv basariyla kuruldu!"));
			return true;
		} catch (error) {
			console.error(chalk.red("mpv kurulumu basarisiz oldu. lutfen manuel olarak kurunuz veya homebrew'in yuklu oldugundan emin olun."));
			return false;
		}
	} else if (platform === "linux") {
		console.log(chalk.cyan("mpv player bulunamadi. paket yoneticisi ile kurulmaya calisiliyor..."));

		const managers = [
			{ cmd: "apt-get", install: "sudo apt-get update && sudo apt-get install mpv -y" },
			{ cmd: "dnf", install: "sudo dnf install mpv -y" },
			{ cmd: "pacman", install: "sudo pacman -S mpv --noconfirm" },
			{ cmd: "zypper", install: "sudo zypper install mpv -y" },
			{ cmd: "snap", install: "sudo snap install mpv" }
		];

		for (const mgr of managers) {
			try {
				execSync(`which ${mgr.cmd}`, { stdio: "ignore" });
				console.log(chalk.yellow(`${mgr.cmd} tespit edildi. kurulum baslatiliyor (sudo gerekebilir)...`));
				execSync(mgr.install, { stdio: "inherit" });
				console.log(chalk.green("mpv basariyla kuruldu!"));
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
 * Opens the given URL in MPV
 * @param {string} url 
 * @returns {Promise<void>}
 */
export async function openInMpv(url) {
	let mpvPath = await getMpvPath();

	if (!mpvPath) {
		const installed = await installMpv();
		if (installed) {
			mpvPath = await getMpvPath();
		} else {
			throw new Error("mpv player bulunamadi ve kurulamadi.");
		}
	}

	if (!mpvPath) throw new Error("mpv player yolu bulunamadi.");

	return new Promise((resolve, reject) => {
		const args = [url, "--force-window", "--fs"];

		const player = spawn(mpvPath, args, {
			stdio: "ignore",
			detached: true
		});

		player.on("error", (err) => {
			reject(err);
		});

		player.unref();
		resolve();
	});
}
