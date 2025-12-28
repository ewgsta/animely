// @ts-check
import axios from "axios";
import bytes from "bytes";
import chalk from "chalk";
import fs from "fs";
import mime from "mime-types";
import { pipeline } from "stream/promises";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "child_process";
import { getConfig } from "../storage/config.js";
import { commandExists, installPackage } from "../system.js";
import { t } from "../../i18n/index.js";

// @ts-ignore
ffmpeg.setFfmpegPath(ffmpegPath);

/** @type {boolean|null} */
let ytDlpAvailable = null;

/**
 * @param {string} url
 * @param {string} outputPath
 * @param {{ silent?: boolean, onProgress?: (data: { percent: string, downloaded: number, total: number, speed: number, eta: number }) => void }} [options]
 */
export async function download(url, outputPath, options = { silent: false }) {
	if (!url || typeof url !== "string") {
		throw new Error(t("errors.invalidUrl"));
	}

	if (url.includes(".m3u8")) {
		return downloadM3U8(url, outputPath, options);
	}

	const config = getConfig();
	if (config.useAria2) {
		return downloadWithAria2(url, outputPath, options);
	}

	let startByte = 0;


	/**
	 * @param {string} url
	 * @param {string} outputPath
	 * @param {{ silent?: boolean, onProgress?: (data: any) => void }} [options]
	 */
	async function downloadWithAria2(url, outputPath, options = { silent: false }) {
		const __dirname = outputPath.substring(0, outputPath.lastIndexOf("\\"));
		const filename = outputPath.substring(outputPath.lastIndexOf("\\") + 1) + ".mp4";

		const config = getConfig();
		const connections = String(config.aria2Connections || 16);

		if (fs.existsSync(outputPath + ".mp4")) {
			const existingStats = fs.statSync(outputPath + ".mp4");
			if (existingStats.size > 0) {
				if (!options.silent) console.log(chalk.green(t("errors.fileExistsAria2", { path: outputPath + ".mp4" })));
				if (options.onProgress) options.onProgress({ percent: "100", downloaded: existingStats.size, total: existingStats.size, speed: 0, eta: 0 });
				return;
			}
		}

		if (!options.silent) console.log(chalk.cyan("\n" + t("errors.aria2Starting")));

		return new Promise((resolve, reject) => {
			const aria2 = spawn("aria2c", [
				"-x", connections,
				"-s", connections,
				"-k", "1M",
				"-d", __dirname,
				"-o", filename,
				url
			]);

			aria2.stdout.on("data", (data) => {
				const output = data.toString();
				const percentMatch = output.match(/\((\d+)%\)/);
				const speedMatch = output.match(/DL:([\w.]+(?:Ki|Mi|Gi)?B)/);

				if (percentMatch) {
					const percent = percentMatch[1];
					const speedRaw = speedMatch ? speedMatch[1] : "0B";

					if (options.onProgress) {
						options.onProgress({ percent: percent, downloaded: 0, total: 0, speed: 0, eta: 0 });
					}

					if (!options.silent) {
						const barLength = 30;
						const filledLength = Math.floor((parseInt(percent) / 100) * barLength);
						const progressBar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);
						const out = t("progress.aria2Progress", { bar: progressBar, percent, speed: speedRaw });
						process.stdout.clearLine(0);
						process.stdout.cursorTo(0);
						process.stdout.write(chalk.gray(out));
					}
				}
			});

			aria2.on("close", (code) => {
				if (code === 0) {
					if (!options.silent) {
						process.stdout.write("\n");
						console.log(chalk.green(t("errors.downloadCompleted", { path: outputPath + ".mp4" })));
					}
					resolve();
				} else {
					reject(new Error(t("errors.aria2Error", { code })));
				}
			});

			aria2.on("error", (err) => {
				reject(new Error(t("errors.aria2StartFailed", { message: err.message })));
			});
		});
	}


	let totalLength = 0;
	let extension = "";
	let fullPath = "";

	try {
		const headResponse = await axios.head(url, { timeout: 10000 });
		if (headResponse.status === 200) {
			const contentType = headResponse.headers["content-type"] || "video/mp4";
			extension = mime.extension(contentType) || "mp4";
			totalLength = parseInt(headResponse.headers["content-length"] || "0", 10);
			fullPath = `${outputPath}.${extension}`;

			if (fs.existsSync(fullPath)) {
				const stats = fs.statSync(fullPath);
				const existingSize = stats.size;

				if (totalLength > 0 && existingSize === totalLength) {
					if (!options.silent) console.log(chalk.green(t("errors.fileExists", { path: fullPath })));
					if (options.onProgress) options.onProgress({ percent: "100", downloaded: totalLength, total: totalLength, speed: 0, eta: 0 });
					return;
				}

				if (totalLength > 0 && existingSize < totalLength) {
					startByte = existingSize;
					if (!options.silent) console.log(chalk.yellow(t("errors.resumingDownload", { downloaded: bytes(startByte), total: bytes(totalLength) })));
				}
			}
		}
	} catch (error) {
	}

	let response;
	try {
		const headers = {};
		if (startByte > 0) {
			headers["Range"] = `bytes=${startByte}-`;
		}

		response = await axios({
			method: "get",
			url,
			responseType: "stream",
			timeout: 30000,
			headers
		});
	} catch (error) {
		if (error.code === "ENOTFOUND") {
			throw new Error(t("errors.noInternet"));
		} else if (error.code === "ECONNABORTED") {
			throw new Error(t("errors.timeout"));
		}
		throw new Error(t("errors.downloadFailed", { message: error.message }));
	}

	if (response.status !== 200 && response.status !== 206) {
		throw new Error(t("errors.serverError", { status: response.status, statusText: response.statusText }));
	}


	const isResuming = response.status === 206;
	if (startByte > 0 && !isResuming) {
		startByte = 0;
	}

	/** @type {string} */
	const contentType = response.headers["content-type"] || "video/mp4";
	if (!extension) {
		extension = mime.extension(contentType) || "mp4";
	}
	if (!fullPath) {
		fullPath = `${outputPath}.${extension}`;
	}

	if (isResuming) {
		const contentRange = response.headers["content-range"];
		if (contentRange) {
			const match = contentRange.match(/\/(\d+)$/);
			if (match) {
				totalLength = parseInt(match[1], 10);
			}
		} else {
			totalLength = startByte + parseInt(response.headers["content-length"] || "0", 10);
		}
	} else {
		totalLength = parseInt(response.headers["content-length"] || "0", 10);
	}

	let downloaded = startByte;
	let lastDownloaded = startByte;
	let lastTime = Date.now();

	if (!options.silent) {
		if (!isResuming) console.log(chalk.cyan("\n" + t("progress.downloadStarting")));

		if (totalLength) {
			const percent = ((downloaded / totalLength) * 100).toFixed(1);
			const msg = t("progress.downloadingPercent", { percent, downloaded: bytes(downloaded), total: bytes(totalLength) });
			if (process.stdout.isTTY) {
				process.stdout.clearLine(0);
				process.stdout.cursorTo(0);
				process.stdout.write(chalk.gray(msg));
			} else {
				process.stdout.write(chalk.gray(`\r${msg}`));
			}
		} else {
			const msg = t("progress.uploading", { downloaded: bytes(downloaded) });
			if (process.stdout.isTTY) {
				process.stdout.clearLine(0);
				process.stdout.cursorTo(0);
				process.stdout.write(chalk.gray(msg));
			} else {
				process.stdout.write(chalk.gray(`\r${msg}`));
			}
		}
	}


	response.data.on("data", (/** @type {any[]} */ chunk) => {
		downloaded += chunk.length;

		const now = Date.now();
		const timeDiff = now - lastTime;
		if (timeDiff >= 1000) {
			const speed = (downloaded - lastDownloaded) / (timeDiff / 1000);
			const remaining = totalLength - downloaded;
			const eta = speed > 0 ? Math.ceil(remaining / speed) : 0;

			lastTime = now;
			lastDownloaded = downloaded;

			if (totalLength) {
				const percentValue = (downloaded / totalLength) * 100;
				const percent = percentValue.toFixed(1);

				if (options.onProgress) {
					options.onProgress({ percent, downloaded, total: totalLength, speed, eta });
				}

				if (!options.silent) {
					const barLength = 30;
					const filledLength = Math.floor((percentValue / 100) * barLength);
					const progressBar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);

					const h = Math.floor(eta / 3600);
					const m = Math.floor((eta % 3600) / 60);
					const s = eta % 60;
					const etaStr = h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;

					const output = t("progress.progressBar", { bar: progressBar, percent, downloaded: bytes(downloaded), total: bytes(totalLength), speed: bytes(speed), eta: etaStr });
					process.stdout.write(`\x1b[2K\x1b[0G${chalk.gray(output)}`);
				}
			} else {
				if (options.onProgress) {
					options.onProgress({ percent: "0", downloaded, total: 0, speed, eta: 0 });
				}

				if (!options.silent) {
					const output = t("progress.uploadingSpeed", { downloaded: bytes(downloaded), speed: bytes(speed) });
					process.stdout.write(`\x1b[2K\x1b[0G${chalk.gray(output)}`);
				}
			}
		}
	});

	try {
		const writer = fs.createWriteStream(fullPath, { flags: isResuming ? 'a' : 'w' });
		await pipeline(response.data, writer);

		if (!options.silent) {
			process.stdout.write("\n");
			console.log(chalk.green(t("errors.fileSaved", { path: fullPath })));
		}
	} catch (error) {
		if (!isResuming && fs.existsSync(fullPath)) {
			fs.unlinkSync(fullPath);
		}
		throw new Error(t("errors.fileWriteError", { message: error.message }));
	}
}


/**
 * M3U8 
 * @param {string} url 
 * @param {string} outputPath 
 * @param {{ silent?: boolean, onProgress?: (data: { percent: string, downloaded: number, total: number, speed: number, eta: number }) => void }} [options]
 */
async function downloadM3U8(url, outputPath, options = { silent: false }) {
	const fullPath = `${outputPath}.mp4`;

	if (fs.existsSync(fullPath)) {
		if (!options.silent) console.log(chalk.green(t("errors.fileExistsM3U8", { path: fullPath })));
		if (options.onProgress) options.onProgress({ percent: "100", downloaded: 0, total: 0, speed: 0, eta: 0 });
		return;
	}

	const config = getConfig();
	
	if (config.useYtDlp) {
		if (ytDlpAvailable === null) {
			ytDlpAvailable = commandExists("yt-dlp");
			
			if (!ytDlpAvailable) {
				if (!options.silent) {
					console.log(chalk.yellow("\n" + t("errors.ytDlpNotFound")));
					console.log(chalk.cyan(t("errors.ytDlpInstalling")));
				}
				
				const installed = installPackage("yt-dlp");
				if (installed) {
					ytDlpAvailable = true;
					if (!options.silent) console.log(chalk.green(t("errors.ytDlpInstalled")));
				} else {
					ytDlpAvailable = false;
					if (!options.silent) console.log(chalk.yellow(t("errors.ytDlpInstallFailed")));
				}
			}
		}
		
		if (ytDlpAvailable) {
			try {
				await downloadM3U8WithYtDlp(url, outputPath, options);
				return;
			} catch (error) {
				if (!options.silent) {
					console.log(chalk.yellow("\n" + t("errors.ytDlpFailed")));
				}
			}
		}
	}

	if (!options.silent) console.log(chalk.cyan("\n" + t("errors.m3u8Processing")));

	return new Promise((resolve, reject) => {
		ffmpeg(url)
			.on('error', (err) => {
				reject(new Error(t("errors.ffmpegError", { message: err.message })));
			})
			.on('progress', (progress) => {
				const percent = progress.percent ? progress.percent.toFixed(1) : "0";
				const downloadedBytes = (progress.targetSize || 0) * 1024;

				if (options.onProgress) {
					options.onProgress({ percent, downloaded: downloadedBytes, total: 0, speed: 0, eta: 0 });
				}

				if (!options.silent) {
					const output = t("progress.processingPercent", { percent, downloaded: bytes(downloadedBytes) });
					process.stdout.clearLine(0);
					process.stdout.cursorTo(0);
					process.stdout.write(`\x1b[2K\x1b[0G${chalk.gray(output)}`);
				}
			})
			.on('end', () => {
				if (!options.silent) {
					process.stdout.write("\n");
					console.log(chalk.green(t("errors.fileSaved", { path: fullPath })));
				}
				resolve();
			})
			.outputOptions('-c copy')
			.outputOptions('-bsf:a aac_adtstoasc')
			.save(fullPath);
	});
}

/**
 * @param {string} url 
 * @param {string} outputPath 
 * @param {{ silent?: boolean, onProgress?: (data: { percent: string, downloaded: number, total: number, speed: number, eta: number }) => void }} [options]
 */
async function downloadM3U8WithYtDlp(url, outputPath, options = { silent: false }) {
	const fullPath = `${outputPath}.mp4`;
	const config = getConfig();
	const connections = String(config.ytDlpConnections || 16);

	if (!options.silent) console.log(chalk.cyan("\n" + t("errors.ytDlpStarting")));

	return new Promise((resolve, reject) => {
		const ytDlp = spawn("yt-dlp", [
			"--no-warnings",
			"--no-playlist",
			"-N", connections,
			"--fragment-retries", "infinite",
			"--no-skip-unavailable-fragments",
			"-o", fullPath,
			url
		]);

		ytDlp.stdout.on("data", (data) => {
			const output = data.toString();
			
			// Progress parsing: [download]  45.2% of ~50.00MiB at 2.50MiB/s ETA 00:15
			const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
			const speedMatch = output.match(/at\s+([\d.]+\s*\w+\/s)/);
			const etaMatch = output.match(/ETA\s+(\d+:\d+)/);

			if (progressMatch) {
				const percent = progressMatch[1];
				const speed = speedMatch ? speedMatch[1] : "";
				const eta = etaMatch ? etaMatch[1] : "";

				if (options.onProgress) {
					options.onProgress({ percent, downloaded: 0, total: 0, speed: 0, eta: 0 });
				}

				if (!options.silent) {
					const barLength = 30;
					const percentNum = parseFloat(percent);
					const filledLength = Math.floor((percentNum / 100) * barLength);
					const progressBar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);
					const out = t("progress.ytDlpProgress", { bar: progressBar, percent, speed, eta });
					process.stdout.write(`\x1b[2K\x1b[0G${chalk.gray(out)}`);
				}
			}
		});

		ytDlp.stderr.on("data", (data) => {
			const output = data.toString();
			const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
			if (progressMatch && options.onProgress) {
				options.onProgress({ percent: progressMatch[1], downloaded: 0, total: 0, speed: 0, eta: 0 });
			}
		});

		ytDlp.on("close", (code) => {
			if (code === 0) {
				if (!options.silent) {
					process.stdout.write("\n");
					console.log(chalk.green(t("errors.downloadCompleted", { path: fullPath })));
				}
				resolve();
			} else {
				reject(new Error(t("errors.ytDlpError", { code })));
			}
		});

		ytDlp.on("error", (err) => {
			reject(new Error(t("errors.ytDlpStartFailed", { message: err.message })));
		});
	});
}

/**
 * @param {string} url 
 * @param {string} outputPath 
 * @param {{ silent?: boolean, onProgress?: (data: any) => void }} [options]
 * @param {{ count: number, delay: number }} [retryOptions]
 */
export async function dl(url, outputPath, options, retryOptions = { count: 3, delay: 3000 }) {
	let attempt = 0;
	while (attempt <= retryOptions.count) {
		try {
			await download(url, outputPath, options);
			return;
		} catch (error) {
			attempt++;
			if (attempt > retryOptions.count) throw error;

			if (!options?.silent) {
				console.log(chalk.yellow("\n" + t("errors.retrying", { attempt, total: retryOptions.count })));
			}
			await new Promise(resolve => setTimeout(resolve, retryOptions.delay));
		}
	}
}
