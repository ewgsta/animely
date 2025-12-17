// @ts-check
import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import chalk from "chalk";

const isWindows = os.platform() === "win32";

/**
 * Checks if VLC is installed/available in PATH or common locations
 * @returns {Promise<string|null>} Path to VLC executable or null
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
			// kontrol ediom
			const result = execSync("where vlc").toString().trim().split("\n")[0];
			if (result && fs.existsSync(result)) return result;
		} catch (e) {
			// bulamadım
		}
	} else {
		try {
			const result = execSync("which vlc").toString().trim();
			if (result) return result;
		} catch (e) {
			// bulamadım
		}
		
		if (fs.existsSync("/usr/bin/vlc")) return "/usr/bin/vlc";
		if (fs.existsSync("/Applications/VLC.app/Contents/MacOS/VLC")) return "/Applications/VLC.app/Contents/MacOS/VLC";
	}

	return null;
}

/**
 * Tries to install VLC using package managers
 * @returns {Promise<boolean>}
 */
export async function installVlc() {
	const platform = os.platform();

	if (platform === "win32") {
		console.log(chalk.cyan("vlc player bulunamadi. winget ile kurulmaya calisiliyor..."));
		try {
			execSync("winget install VideoLAN.VLC -e --source winget", { stdio: "inherit" });
			console.log(chalk.green("vlc basariyla kuruldu!"));
			return true;
		} catch (error) {
			console.error(chalk.red("vlc kurulumu basarisiz oldu. lutfen manuel olarak kurunuz: https://www.videolan.org/vlc/"));
			return false;
		}
	} else if (platform === "darwin") {
		console.log(chalk.cyan("vlc player bulunamadi. homebrew ile kurulmaya calisiliyor..."));
		try {
			execSync("brew install --cask vlc", { stdio: "inherit" });
			console.log(chalk.green("vlc basariyla kuruldu!"));
			return true;
		} catch (error) {
			console.error(chalk.red("vlc kurulumu basarisiz oldu. lutfen manuel olarak kurunuz veya homebrew'in yuklu oldugundan emin olun."));
			return false;
		}
	} else if (platform === "linux") {
		console.log(chalk.cyan("vlc player bulunamadi. paket yoneticisi ile kurulmaya calisiliyor..."));
		
		const managers = [
			{ cmd: "apt-get", install: "sudo apt-get update && sudo apt-get install vlc -y" },
			{ cmd: "dnf", install: "sudo dnf install vlc -y" },
			{ cmd: "pacman", install: "sudo pacman -S vlc --noconfirm" },
			{ cmd: "zypper", install: "sudo zypper install vlc -y" },
			{ cmd: "snap", install: "sudo snap install vlc" }
		];

		for (const mgr of managers) {
			try {
				execSync(`which ${mgr.cmd}`, { stdio: "ignore" });
				console.log(chalk.yellow(`${mgr.cmd} tespit edildi. kurulum baslatiliyor (sudo gerekebilir)...`));
				execSync(mgr.install, { stdio: "inherit" });
				console.log(chalk.green("vlc basariyla kuruldu!"));
				return true;
			} catch (e) {
				continue;
			}
		}
		
		console.error(chalk.red("uygun paket yoneticisi bulunamadi. lutfen vlc'yi manuel olarak kurunuz."));
		return false;
	}

	return false;
}

/**
 * Opens the URL in VLC
 * @param {string} url 
 * @returns {Promise<number|void>}
 */
export async function openInVlc(url) {
	let vlcPath = await getVlcPath();

	if (!vlcPath) {
		const installed = await installVlc();
		if (installed) {
			vlcPath = await getVlcPath();
		} else {
			throw new Error("vlc player bulunamadi ve kurulamadi.");
		}
	}

	if (!vlcPath) throw new Error("vlc path bulunamadi.");

	console.log(chalk.cyan("vlc baslatiliyor..."));
	
	return new Promise((resolve, reject) => {
		const child = spawn(vlcPath, [url], {
			stdio: "ignore"
		});

		child.on('error', (err) => {
			reject(err);
		});

		child.on('close', (code) => {
			resolve(code);
		});
	});
}
