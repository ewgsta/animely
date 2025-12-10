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
 * @param {{ silent?: boolean, onProgress?: (data: { percent: string, downloaded: number, total: number }) => void }} [options]
 */
export async function download(url, outputPath, options = { silent: false }) {
	if (!url || typeof url !== "string") {
		throw new Error("gecersiz url");
	}

	let response;
	try {
		response = await axios({
			method: "get",
			url,
			responseType: "stream",
			timeout: 30000,
		});
	} catch (error) {
		if (error.code === "ENOTFOUND") {
			throw new Error("internet baglantisi bulunamadi");
		} else if (error.code === "ECONNABORTED") {
			throw new Error("baglanti zaman asimina ugradi");
		}
		throw new Error(`indirme baslatilamadi: ${error.message}`);
	}

	if (response.status !== 200) {
		throw new Error(`sunucu hatasi: ${response.status} ${response.statusText}`);
	}

	/** @type {string} */
	const contentType = response.headers["content-type"] || "video/mp4";
	const extension = mime.extension(contentType) || "mp4";
	const totalLength = parseInt(response.headers["content-length"] || "0", 10);

	let downloaded = 0;
	let lastTime = Date.now();

	if (!options.silent) {
		console.log(chalk.cyan("\nindirme basliyor..."));

		if (totalLength) {
			const percent = ((downloaded / totalLength) * 100).toFixed(1);
			process.stdout.write(chalk.gray(`\rindiriliyor: ${percent}% (${bytes(downloaded)} / ${bytes(totalLength)})`));
		} else {
			process.stdout.write(chalk.gray(`\ryukleniyor: ${bytes(downloaded)}`));
		}
	}

	response.data.on("data", (/** @type {any[]} */ chunk) => {
		downloaded += chunk.length;

		const now = Date.now();
		if (now - lastTime >= 1000) {
			lastTime = now;

			if (totalLength) {
				const percentValue = (downloaded / totalLength) * 100;
				const percent = percentValue.toFixed(1);

				if (options.onProgress) {
					options.onProgress({ percent, downloaded, total: totalLength });
				}

				if (!options.silent) {
					const progressBar = "█".repeat(Math.floor(percentValue / 2)) + "░".repeat(50 - Math.floor(percentValue / 2));
					process.stdout.write(chalk.gray(`\r[${progressBar}] ${percent}% (${bytes(downloaded)} / ${bytes(totalLength)})`));
				}
			} else {
				if (options.onProgress) {
					options.onProgress({ percent: "0", downloaded, total: 0 });
				}

				if (!options.silent) {
					process.stdout.write(chalk.gray(`\ryukleniyor: ${bytes(downloaded)}`));
				}
			}
		}
	});

	const fullPath = `${outputPath}.${extension}`;

	try {
		const writer = fs.createWriteStream(fullPath);
		await pipeline(response.data, writer);

		if (!options.silent) {
			process.stdout.write("\n");
			console.log(chalk.green(`dosya basariyla kaydedildi: ${fullPath}`));
		}
	} catch (error) {
		if (fs.existsSync(fullPath)) {
			fs.unlinkSync(fullPath);
		}
		throw new Error(`dosya yazma hatasi: ${error.message}`);
	}
}