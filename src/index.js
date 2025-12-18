#!/usr/bin/env node
import { line } from "./functions/variables.js";
import { spinner } from "./utils/spinner.js";
import { getConfig, saveConfig } from "./utils/config.js";
import { loadQueue, saveQueue } from "./utils/queue.js";
import { initDiscordRpc, setActivity } from "./utils/discord.js";
import { timeFormat } from "./functions/time.js";
import { API_URL } from "./constants.js";

import { showSettings } from "./utils/settings_ui.js";
import { showHistory } from "./utils/show_history.js";
import { processQueue } from "./utils/process_queue.js";
import { searchAndDownload } from "./utils/search_download.js";

import { execSync, spawnSync } from "child_process";
import axios from "axios";
import chalk from "chalk";
import fs from "fs";
import inquirer from "inquirer";
import updateNotifier from "update-notifier";

process.on('SIGINT', () => {
	console.log(chalk.gray("\ngorusmek uzere!"));
	process.exit(0);
});

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"));
const notifier = updateNotifier({
	pkg,
	updateCheckInterval: 0
});

if (notifier.update) {
	console.log(chalk.yellow(`\nguncelleme mevcut: ${chalk.dim(notifier.update.current)} -> ${chalk.green(notifier.update.latest)}`));
	console.log(chalk.cyan("otomatik guncelleme baslatiliyor..."));
	try {
		execSync("npm install -g animely");
		console.log(chalk.green("guncelleme tamamlandi! uygulama yeniden baslatiliyor..."));

		const { status } = spawnSync(process.argv[0], process.argv.slice(1), {
			stdio: "inherit"
		});

		process.exit(status ?? 0);
	} catch (e) {
		console.log(chalk.red("otomatik guncelleme basarisiz oldu."));
		console.log(chalk.yellow("lutfen 'npm install -g animely' komutunu elle calistirin."));
	}
}

import { runSpeedTest } from "./utils/speedtest.js";

(async () => {
	try {
		await initDiscordRpc();

		const speedTestPromise = runSpeedTest();

		spinner.start();

		let animes;
		try {
			const [response] = await Promise.all([
				axios.get(`${API_URL}/animes`),
				speedTestPromise
			]);
			animes = response.data;
		} catch (error) {
			spinner.fail(chalk.red("anime listesi alinamadi. internet baglantini kontrol et"));
			return;
		}
		spinner.stop();

		const downloadQueue = loadQueue();
		const config = getConfig();

		if (!config.defaultPlayer) {
			console.clear();
			console.log(chalk.cyan("hosgeldiniz! lutfen varsayilan video oynaticinizi secin."));
			const { player } = await inquirer.prompt([{
				type: "list",
				name: "player",
				message: "oynatici secimi:",
				choices: [
					{ name: "VLC Media Player (Onerilen)", value: "vlc" },
					{ name: "MPV Player", value: "mpv" }
				]
			}]);
			config.defaultPlayer = player;
			saveConfig(config);
		}

		while (true) {
			console.clear();
			setActivity("Menüde geziniyor");

			console.log([
				`${chalk.gray(timeFormat())} animely-cli`,
				`${chalk.gray(timeFormat())} github ${chalk.blue.underline("https://github.com/ewgsta/animely")}`,
			].join("\n"));

			if (downloadQueue.length > 0) {
				console.log(chalk.yellow(`\n  tamamlanmamis ${downloadQueue.length} indirme var!`));
			}

			console.log(chalk.gray(line.repeat(100)));

			const choices = [
				{ name: "anime ara", value: "search" },
				{ name: "izlediklerim", value: "history" },
				{ name: "ayarlar", value: "settings" }
			];

			if (downloadQueue.length > 0) {
				choices.unshift({ name: `indirme kuyrugunu baslat (${downloadQueue.length} bolum)`, value: "start_queue" });
				choices.unshift({ name: "indirme kuyrugunu temizle", value: "clear_queue" });
			}

			choices.push(new inquirer.Separator());
			choices.push({ name: "cikis", value: "exit" });

			const { action } = await inquirer.prompt([{
				type: "list",
				name: "action",
				message: "ne yapmak istersiniz",
				choices: choices
			}]);

			if (action === "exit") {
				console.log(chalk.gray("gorusmek uzere!"));
				process.exit(0);
			} else if (action === "settings") {
				await showSettings();
			} else if (action === "history") {
				await showHistory();
			} else if (action === "search") {
				await searchAndDownload(animes, downloadQueue);
			} else if (action === "start_queue") {
				await processQueue(downloadQueue);
			} else if (action === "clear_queue") {
				const { confirm } = await inquirer.prompt([{
					type: "confirm",
					name: "confirm",
					message: "indirme kuyrugunu temizlemek istediginize emin misiniz",
					default: false
				}]);

				if (confirm) {
					downloadQueue.length = 0;
					saveQueue(downloadQueue);
					console.log(chalk.green("indirme kuyrugu temizlendi!"));
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			}

			console.log("");
		}

	} catch (error) {
		if (error.message && error.message.includes("User force closed")) {
			console.log(chalk.gray("\ngorusmek uzere!"));
			process.exit(0);
		}
		spinner.fail("beklenmeyen bir hata olustu, lutfen daha sonra tekrar deneyiniz.");
		console.error(chalk.gray(`hata detayi: ${error.message}`));
	}
})();