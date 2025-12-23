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
import { getConfig } from "./config.js";

// @ts-ignore
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 *
 * @param {string} url
 * @param {string} outputPath
 * @param {{ silent?: boolean, onProgress?: (data: { percent: string, downloaded: number, total: number, speed: number, eta: number }) => void }} [options]
 */
export async function download(url, outputPath, options = { silent: false }) {
	if (!url || typeof url !== "string") {
		throw new Error("gecersiz url");
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
		const filename = outputPath.substring(outputPath.lastIndexOf("\\") + 1) + ".mp4"; // Varsayilan olarak mp4 ekliyoruz, aria2 otomatik belirlemiyor bu modda

		const config = getConfig();
		const connections = String(config.aria2Connections || 16);

		if (fs.existsSync(outputPath + ".mp4")) {
			const existingStats = fs.statSync(outputPath + ".mp4");
			if (existingStats.size > 0) {
				if (!options.silent) console.log(chalk.green(`Dosya zaten indirilmiş (Aria2): ${outputPath}.mp4`));
				if (options.onProgress) options.onProgress({ percent: "100", downloaded: existingStats.size, total: existingStats.size, speed: 0, eta: 0 });
				return;
			}
		}

		if (!options.silent) console.log(chalk.cyan("\nAria2 indirme yöneticisi başlatılıyor..."));

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
				const etaMatch = output.match(/ETA:([\w:]+)/);
				const totalMatch = output.match(/\/([\d.]+[KMG]iB)/);

				if (percentMatch) {
					const percent = percentMatch[1];
					const speedRaw = speedMatch ? speedMatch[1] : "0B";
					const eta = 0;

					if (options.onProgress) {
						options.onProgress({
							percent: percent,
							downloaded: 0,
							total: 0,
							speed: 0,
							eta: 0
						});
					}

					if (!options.silent) {
						const barLength = 30;
						const filledLength = Math.floor((parseInt(percent) / 100) * barLength);
						const progressBar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);

						const out = `[${progressBar}] ${percent}% - Hız: ${speedRaw}`;
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
						console.log(chalk.green(`İndirme tamamlandı: ${outputPath}.mp4`));
					}
					resolve();
				} else {
					reject(new Error(`Aria2c hata kodu ile kapandı: ${code}`));
				}
			});

			aria2.on("error", (err) => {
				reject(new Error(`Aria2c başlatılamadı: ${err.message}`));
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
					if (!options.silent) console.log(chalk.green(`Dosya zaten indirilmiş: ${fullPath}`));
					if (options.onProgress) options.onProgress({ percent: "100", downloaded: totalLength, total: totalLength, speed: 0, eta: 0 });
					return;
				}

				if (totalLength > 0 && existingSize < totalLength) {
					startByte = existingSize;
					if (!options.silent) console.log(chalk.yellow(`İndirme devam ettiriliyor: ${bytes(startByte)} / ${bytes(totalLength)}`));
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
			throw new Error("İnternet bağlantısı bulunamadı.");
		} else if (error.code === "ECONNABORTED") {
			throw new Error("Bağlantı zaman aşımına uğradı.");
		}
		throw new Error(`İndirme başlatılamadı: ${error.message}`);
	}

	if (response.status !== 200 && response.status !== 206) {
		throw new Error(`Sunucu hatası: ${response.status} ${response.statusText}`);
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
		if (!isResuming) console.log(chalk.cyan("\nİndirme başlıyor..."));

		if (totalLength) {
			const percent = ((downloaded / totalLength) * 100).toFixed(1);
			if (process.stdout.isTTY) {
				process.stdout.clearLine(0);
				process.stdout.cursorTo(0);
				process.stdout.write(chalk.gray(`İndiriliyor: ${percent}% (${bytes(downloaded)} / ${bytes(totalLength)})`));
			} else {
				process.stdout.write(chalk.gray(`\rİndiriliyor: ${percent}% (${bytes(downloaded)} / ${bytes(totalLength)})`));
			}
		} else {
			if (process.stdout.isTTY) {
				process.stdout.clearLine(0);
				process.stdout.cursorTo(0);
				process.stdout.write(chalk.gray(`Yükleniyor: ${bytes(downloaded)}`));
			} else {
				process.stdout.write(chalk.gray(`\rYükleniyor: ${bytes(downloaded)}`));
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
					const etaStr = h > 0 ? `${h}s ${m}dk ${s}sn` : m > 0 ? `${m}dk ${s}sn` : `${s}sn`;

					const output = `[${progressBar}] ${percent}% (${bytes(downloaded)} / ${bytes(totalLength)}) - ${bytes(speed)}/s - Kalan: ${etaStr}`;

					process.stdout.write(`\x1b[2K\x1b[0G${chalk.gray(output)}`);
				}
			} else {
				if (options.onProgress) {
					options.onProgress({ percent: "0", downloaded, total: 0, speed, eta: 0 });
				}

				if (!options.silent) {
					const output = `Yükleniyor: ${bytes(downloaded)} - ${bytes(speed)}/s`;
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
			console.log(chalk.green(`Dosya başarıyla kaydedildi: ${fullPath}`));
		}
	} catch (error) {
		if (!isResuming && fs.existsSync(fullPath)) {
			fs.unlinkSync(fullPath);
		}
		throw new Error(`Dosya yazma hatası: ${error.message}`);
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
		if (!options.silent) console.log(chalk.green(`Dosya zaten indirilmiş (M3U8): ${fullPath}`));
		if (options.onProgress) options.onProgress({ percent: "100", downloaded: 0, total: 0, speed: 0, eta: 0 });
		return;
	}

	if (!options.silent) console.log(chalk.cyan("\nM3U8 indiriliyor ve işleniyor (Bu işlem biraz zaman alabilir)..."));

	return new Promise((resolve, reject) => {
		ffmpeg(url)
			.on('start', () => {
				// bildirim yok
			})
			.on('error', (err) => {
				reject(new Error(`FFmpeg hatası: ${err.message}`));
			})
			.on('progress', (progress) => {
				const percent = progress.percent ? progress.percent.toFixed(1) : "0";
				const downloadedBytes = (progress.targetSize || 0) * 1024;

				if (options.onProgress) {
					options.onProgress({
						percent,
						downloaded: downloadedBytes,
						total: 0,
						speed: 0,
						eta: 0
					});
				}

				if (!options.silent) {
					const output = `İşleniyor: ${percent}% (${bytes(downloadedBytes)})`;
					process.stdout.clearLine(0);
					process.stdout.cursorTo(0);
					process.stdout.write(`\x1b[2K\x1b[0G${chalk.gray(output)}`);
				}
			})
			.on('end', () => {
				if (!options.silent) {
					process.stdout.write("\n");
					console.log(chalk.green(`Dosya başarıyla kaydedildi: ${fullPath}`));
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
				console.log(chalk.yellow(`\nTekrar deneniyor (${attempt}/${retryOptions.count})...`));
			}
			await new Promise(resolve => setTimeout(resolve, retryOptions.delay));
		}
	}
}