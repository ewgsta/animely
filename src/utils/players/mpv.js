// @ts-check
import { spawn, execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import net from "net";
import chalk from "chalk";
import { t } from "../../i18n/index.js";

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
		console.log(chalk.cyan(t("errors.mpvNotFound", { manager: "Winget" })));
		try {
			execSync("winget install io.mpv.mpv -e --source winget", { stdio: "inherit" });
			console.log(chalk.green(t("errors.mpvInstalled")));
			return true;
		} catch (error) {
			console.error(chalk.red(t("errors.mpvInstallFailed")));
			return false;
		}
	} else if (platform === "darwin") {
		console.log(chalk.cyan(t("errors.mpvNotFound", { manager: "Homebrew" })));
		try {
			execSync("brew install mpv", { stdio: "inherit" });
			console.log(chalk.green(t("errors.mpvInstalled")));
			return true;
		} catch (error) {
			console.error(chalk.red(t("errors.mpvInstallFailedMac")));
			return false;
		}
	} else if (platform === "linux") {
		console.log(chalk.cyan(t("errors.mpvNotFound", { manager: "package manager" })));

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
				console.log(chalk.yellow(t("errors.managerDetected", { manager: mgr.cmd })));
				execSync(mgr.install, { stdio: "inherit" });
				console.log(chalk.green(t("errors.mpvInstalled")));
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
 * @returns {string}
 */
function getSocketPath() {
	if (isWindows) {
		return "\\\\.\\pipe\\animely-mpv-socket";
	}
	return path.join(os.tmpdir(), `animely-mpv-${process.pid}.sock`);
}

/**
 * @param {string} socketPath
 * @param {string} command
 * @returns {Promise<any>}
 */
function sendMpvCommand(socketPath, command) {
	return new Promise((resolve, reject) => {
		const client = net.createConnection(socketPath, () => {
			client.write(command + "\n");
		});

		let data = "";
		client.on("data", (chunk) => {
			data += chunk.toString();
			try {
				const lines = data.split("\n").filter(l => l.trim());
				for (const line of lines) {
					const parsed = JSON.parse(line);
					if (parsed.data !== undefined || parsed.error) {
						client.end();
						resolve(parsed);
						return;
					}
				}
			} catch (e) {

			}
		});

		client.on("error", reject);
		client.setTimeout(2000, () => {
			client.end();
			reject(new Error("Timeout"));
		});
	});
}

/**
 * @param {string} socketPath
 * @returns {Promise<{position: number, duration: number}|null>}
 */
async function getMpvPosition(socketPath) {
	try {
		const posResult = await sendMpvCommand(socketPath, '{"command": ["get_property", "time-pos"]}');
		const durResult = await sendMpvCommand(socketPath, '{"command": ["get_property", "duration"]}');

		if (posResult?.data !== undefined && durResult?.data !== undefined) {
			return {
				position: Math.floor(posResult.data),
				duration: Math.floor(durResult.data)
			};
		}
	} catch (e) {

	}
	return null;
}

/**
 * @param {string} url
 * @param {object} [options]
 * @param {number} [options.startPosition] 
 * @param {(position: number, duration: number) => void} [options.onClose]
 * @returns {Promise<void>}
 */
export async function openInMpv(url, options = {}) {
	let mpvPath = await getMpvPath();

	if (!mpvPath) {
		const installed = await installMpv();
		if (installed) {
			mpvPath = await getMpvPath();
		} else {
			throw new Error(t("errors.mpvNotFoundAndFailed"));
		}
	}

	if (!mpvPath) throw new Error(t("errors.mpvPathNotFound"));

	const socketPath = getSocketPath();

	if (!isWindows && fs.existsSync(socketPath)) {
		try {
			fs.unlinkSync(socketPath);
		} catch (e) {}
	}

	return new Promise((resolve, reject) => {
		const args = [
			url,
			"--force-window",
			"--fs",
			`--input-ipc-server=${socketPath}`
		];

		// Başlangıç pozisyonu varsa ekle
		if (options.startPosition && options.startPosition > 0) {
			args.push(`--start=${options.startPosition}`);
		}

		const player = spawn(mpvPath, args, {
			stdio: "ignore",
			detached: false
		});

		let lastPosition = null;
		let positionInterval = null;

		const startTracking = () => {
			positionInterval = setInterval(async () => {
				const pos = await getMpvPosition(socketPath);
				if (pos) {
					lastPosition = pos;
				}
			}, 3000);
		};

		setTimeout(startTracking, 2000);

		player.on("error", (err) => {
			if (positionInterval) clearInterval(positionInterval);
			reject(err);
		});

		player.on("close", () => {
			if (positionInterval) clearInterval(positionInterval);

			if (!isWindows && fs.existsSync(socketPath)) {
				try {
					fs.unlinkSync(socketPath);
				} catch (e) {}
			}

			if (lastPosition && options.onClose) {
				options.onClose(lastPosition.position, lastPosition.duration);
			}

			resolve();
		});
	});
}
