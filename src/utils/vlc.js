// @ts-check
import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import chalk from "chalk";

const isWindows = os.platform() === "win32";

/**
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
			const result = execSync("where vlc").toString().trim().split("\n")[0];
			if (result && fs.existsSync(result)) return result;
		} catch (e) {
		}
	} else {
		try {
			const result = execSync("which vlc").toString().trim();
			if (result) return result;
		} catch (e) {
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
		console.log(chalk.cyan("VLC Player bulunamadı. Winget ile kurulmaya çalışılıyor..."));
		try {
			execSync("winget install VideoLAN.VLC -e --source winget", { stdio: "inherit" });
			console.log(chalk.green("VLC başarıyla kuruldu!"));
			return true;
		} catch (error) {
			console.error(chalk.red("VLC kurulumu başarısız oldu. Lütfen manuel olarak kurunuz: https://www.videolan.org/vlc/"));
			return false;
		}
	} else if (platform === "darwin") {
		console.log(chalk.cyan("VLC Player bulunamadı. Homebrew ile kurulmaya çalışılıyor..."));
		try {
			execSync("brew install --cask vlc", { stdio: "inherit" });
			console.log(chalk.green("VLC başarıyla kuruldu!"));
			return true;
		} catch (error) {
			console.error(chalk.red("VLC kurulumu başarısız oldu. Lütfen manuel olarak kurunuz veya Homebrew'in yüklü olduğundan emin olun."));
			return false;
		}
	} else if (platform === "linux") {
		console.log(chalk.cyan("VLC Player bulunamadı. Paket yöneticisi ile kurulmaya çalışılıyor..."));

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
				console.log(chalk.yellow(`${mgr.cmd} tespit edildi. Kurulum başlatılıyor (sudo gerekebilir)...`));
				execSync(mgr.install, { stdio: "inherit" });
				console.log(chalk.green("VLC başarıyla kuruldu!"));
				return true;
			} catch (e) {
				continue;
			}
		}

		console.error(chalk.red("Uygun paket yöneticisi bulunamadı. Lütfen VLC'yi manuel olarak kurunuz."));
		return false;
	}

	return false;
}

/**
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
			throw new Error("VLC Player bulunamadı ve kurulamadı.");
		}
	}

	if (!vlcPath) throw new Error("VLC dosya yolu bulunamadı.");

	console.log(chalk.cyan("VLC başlatılıyor..."));

	return new Promise((resolve, reject) => {
		const child = spawn(vlcPath, ["--fullscreen", url], {
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
