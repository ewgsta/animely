// @ts-check
import { spawn, execSync } from "child_process";
import fs from "fs";
import os from "os";
import net from "net";
import chalk from "chalk";

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
			console.error(chalk.red("VLC kurulumu başarısız oldu."));
			return false;
		}
	} else if (platform === "darwin") {
		console.log(chalk.cyan("VLC Player bulunamadı. Homebrew ile kurulmaya çalışılıyor..."));
		try {
			execSync("brew install --cask vlc", { stdio: "inherit" });
			console.log(chalk.green("VLC başarıyla kuruldu!"));
			return true;
		} catch (error) {
			console.error(chalk.red("VLC kurulumu başarısız oldu."));
			return false;
		}
	} else if (platform === "linux") {
		console.log(chalk.cyan("VLC Player bulunamadı. Paket yöneticisi ile kurulmaya çalışılıyor..."));

		const managers = [
			{ cmd: "apt-get", install: "sudo apt-get update && sudo apt-get install vlc -y" },
			{ cmd: "dnf", install: "sudo dnf install vlc -y" },
			{ cmd: "pacman", install: "sudo pacman -S vlc --noconfirm" }
		];

		for (const mgr of managers) {
			try {
				execSync(`which ${mgr.cmd}`, { stdio: "ignore" });
				execSync(mgr.install, { stdio: "inherit" });
				console.log(chalk.green("VLC başarıyla kuruldu!"));
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
 * @returns {number}
 */
function getRandomPort() {
	return Math.floor(Math.random() * (65535 - 49152) + 49152);
}

/**
 * @param {number} port
 * @param {string} password
 * @param {string} command
 * @returns {Promise<string>}
 */
function sendVlcCommand(port, password, command) {
	return new Promise((resolve, reject) => {
		const client = net.createConnection({ port, host: "127.0.0.1" }, () => {});

		let data = "";
		let authenticated = false;

		client.on("data", (chunk) => {
			data += chunk.toString();

			if (!authenticated && data.includes("Password:")) {
				client.write(password + "\n");
				authenticated = true;
				data = "";
			} else if (authenticated && data.includes(">")) {
				if (command) {
					client.write(command + "\n");
					command = "";
					data = "";
				} else {
					client.end();
					resolve(data);
				}
			}
		});

		client.on("error", reject);
		client.setTimeout(3000, () => {
			client.end();
			reject(new Error("Timeout"));
		});
	});
}

/**
 * @param {number} port
 * @param {string} password
 * @returns {Promise<{position: number, duration: number}|null>}
 */
async function getVlcPosition(port, password) {
	try {
		const statusData = await sendVlcCommand(port, password, "get_time");
		const posMatch = statusData.match(/(\d+)/);
		const position = posMatch ? parseInt(posMatch[1], 10) : 0;

		const lengthData = await sendVlcCommand(port, password, "get_length");
		const durMatch = lengthData.match(/(\d+)/);
		const duration = durMatch ? parseInt(durMatch[1], 10) : 0;

		return { position, duration };
	} catch (e) {}
	return null;
}

/**
 * @param {string} url
 * @param {object} [options]
 * @param {number} [options.startPosition]
 * @param {(position: number, duration: number) => void} [options.onClose]
 * @returns {Promise<number|void>}
 */
export async function openInVlc(url, options = {}) {
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

	const telnetPort = getRandomPort();
	const telnetPassword = "animely" + Date.now();

	return new Promise((resolve, reject) => {
		const args = [
			"--fullscreen",
			"--extraintf=rc",
			`--rc-host=127.0.0.1:${telnetPort}`,
			`--rc-password=${telnetPassword}`,
			url
		];

		if (options.startPosition && options.startPosition > 0) {
			args.push(`--start-time=${options.startPosition}`);
		}

		const child = spawn(vlcPath, args, { stdio: "ignore" });

		let lastPosition = null;
		let positionInterval = null;

		const startTracking = () => {
			positionInterval = setInterval(async () => {
				const pos = await getVlcPosition(telnetPort, telnetPassword);
				if (pos && pos.position > 0) {
					lastPosition = pos;
				}
			}, 3000);
		};

		setTimeout(startTracking, 3000);

		child.on('error', (err) => {
			if (positionInterval) clearInterval(positionInterval);
			reject(err);
		});

		child.on('close', (code) => {
			if (positionInterval) clearInterval(positionInterval);

			if (lastPosition && options.onClose) {
				options.onClose(lastPosition.position, lastPosition.duration);
			}

			resolve(code);
		});
	});
}