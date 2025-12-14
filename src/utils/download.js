// @ts-check
import axios from "axios";
import bytes from "bytes";
import chalk from "chalk";
import fs from "fs";
import mime from "mime-types";
import { pipeline } from "stream/promises";

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

	let startByte = 0;
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
					if (!options.silent) console.log(chalk.green(`dosya zaten inmis: ${fullPath}`));
					if (options.onProgress) options.onProgress({ percent: "100", downloaded: totalLength, total: totalLength, speed: 0, eta: 0 });
					return;
				}

				if (totalLength > 0 && existingSize < totalLength) {
					startByte = existingSize;
					if (!options.silent) console.log(chalk.yellow(`indirme devam ettiriliyor: ${bytes(startByte)} / ${bytes(totalLength)}`));
				}
			}
		}
	} catch (error) {
		// AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
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
			throw new Error("internet baglantisi bulunamadi");
		} else if (error.code === "ECONNABORTED") {
			throw new Error("baglanti zaman asimina ugradi");
		}
		throw new Error(`indirme baslatilamadi: ${error.message}`);
	}

	if (response.status !== 200 && response.status !== 206) {
		throw new Error(`sunucu hatasi: ${response.status} ${response.statusText}`);
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
		if (!isResuming) console.log(chalk.cyan("\nindirme basliyor..."));

		if (totalLength) {
			const percent = ((downloaded / totalLength) * 100).toFixed(1);
			if (process.stdout.isTTY) {
				process.stdout.clearLine(0);
				process.stdout.cursorTo(0);
				process.stdout.write(chalk.gray(`indiriliyor: ${percent}% (${bytes(downloaded)} / ${bytes(totalLength)})`));
			} else {
				process.stdout.write(chalk.gray(`\rindiriliyor: ${percent}% (${bytes(downloaded)} / ${bytes(totalLength)})`));
			}
		} else {
			if (process.stdout.isTTY) {
				process.stdout.clearLine(0);
				process.stdout.cursorTo(0);
				process.stdout.write(chalk.gray(`yukleniyor: ${bytes(downloaded)}`));
			} else {
				process.stdout.write(chalk.gray(`\ryukleniyor: ${bytes(downloaded)}`));
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
					
					// ETA Format
					const h = Math.floor(eta / 3600);
					const m = Math.floor((eta % 3600) / 60);
					const s = eta % 60;
					const etaStr = h > 0 ? `${h}s ${m}dk ${s}sn` : m > 0 ? `${m}dk ${s}sn` : `${s}sn`;

					const output = `[${progressBar}] ${percent}% (${bytes(downloaded)} / ${bytes(totalLength)}) - ${bytes(speed)}/s - kalan: ${etaStr}`;
					
					// Use ANSI escape codes for better compatibility
					// \x1b[2K clears the entire line
					// \x1b[0G moves cursor to column 0
					process.stdout.write(`\x1b[2K\x1b[0G${chalk.gray(output)}`);
				}
			} else {
				if (options.onProgress) {
					options.onProgress({ percent: "0", downloaded, total: 0, speed, eta: 0 });
				}

				if (!options.silent) {
					const output = `yukleniyor: ${bytes(downloaded)} - ${bytes(speed)}/s`;
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
			console.log(chalk.green(`dosya basariyla kaydedildi: ${fullPath}`));
		}
	} catch (error) {
		if (!isResuming && fs.existsSync(fullPath)) {
			fs.unlinkSync(fullPath);
		}
		throw new Error(`dosya yazma hatasi: ${error.message}`);
	}
}