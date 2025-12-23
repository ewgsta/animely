// @ts-check
import { spawn, execSync } from "child_process";
import fs from "fs";
import os from "os";
import chalk from "chalk";

const isWindows = os.platform() === "win32";

/**
 * @returns {Promise<string|null>}
 */
export async function getMpvPath() {
	if (isWindows) {
		const commonPaths = [
			"C:\\Program Files\\MPV\\mpv.exe",
			"C:\\Program Files (x86)\\MPV\\mpv.exe",
			"C:\\ProgramData\\chocolatey\\bin\\mpv.exe",
			`${process.env.USERPROFILE}\\scoop\\apps\\mpv\\current\\mpv.exe`
		];

		for (const p of commonPaths) {
			if (fs.existsSync(p)) return p;
		}

		try {
			const result = execSync("where mpv").toString().trim().split("\n")[0];
			if (result && fs.existsSync(result)) return result;
		} catch (e) {
		}
	} else {
		try {
			const result = execSync("which mpv").toString().trim();
			if (result) return result;
		} catch (e) {
		}

		if (fs.existsSync("/usr/bin/mpv")) return "/usr/bin/mpv";
		if (fs.existsSync("/usr/local/bin/mpv")) return "/usr/local/bin/mpv";
		if (fs.existsSync("/opt/homebrew/bin/mpv")) return "/opt/homebrew/bin/mpv";
	}

	return null;
}

/**
 * @returns {Promise<boolean>}
 */
export async function installMpv() {
	const platform = os.platform();

	if (platform === "win32") {
		console.log(chalk.cyan("MPV Player bulunamadı. Winget ile kurulmaya çalışılıyor..."));
		try {
			execSync("winget install io.mpv.mpv -e --source winget", { stdio: "inherit" });
			console.log(chalk.green("MPV başarıyla kuruldu!"));
			return true;
		} catch (error) {
			console.error(chalk.red("MPV kurulumu başarısız oldu. Lütfen manuel olarak kurunuz: https://mpv.io/installation/"));
			return false;
		}
	} else if (platform === "darwin") {
		console.log(chalk.cyan("MPV Player bulunamadı. Homebrew ile kurulmaya çalışılıyor..."));
		try {
			execSync("brew install mpv", { stdio: "inherit" });
			console.log(chalk.green("MPV başarıyla kuruldu!"));
			return true;
		} catch (error) {
			console.error(chalk.red("MPV kurulumu başarısız oldu. Lütfen manuel olarak kurunuz veya Homebrew'in yüklü olduğundan emin olun."));
			return false;
		}
	} else if (platform === "linux") {
		console.log(chalk.cyan("MPV Player bulunamadı. Paket yöneticisi ile kurulmaya çalışılıyor..."));

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
				console.log(chalk.yellow(`${mgr.cmd} tespit edildi. Kurulum başlatılıyor (sudo gerekebilir)...`));
				execSync(mgr.install, { stdio: "inherit" });
				console.log(chalk.green("MPV başarıyla kuruldu!"));
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
 * @returns {Promise<void>}
 */
export async function openInMpv(url) {
	let mpvPath = await getMpvPath();

	if (!mpvPath) {
		const installed = await installMpv();
		if (installed) {
			mpvPath = await getMpvPath();
		} else {
			throw new Error("MPV Player bulunamadı ve kurulamadı.");
		}
	}

	if (!mpvPath) throw new Error("MPV Player dosya yolu bulunamadı.");

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
