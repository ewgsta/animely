#!/usr/bin/env node
import { line } from "./functions/variables.js";
import { spinner } from "./utils/spinner.js";
import { getConfig, saveConfig } from "./utils/config.js";
import { loadQueue, saveQueue } from "./utils/queue.js";
import { initDiscordRpc, setActivity } from "./utils/discord.js";
import { timeFormat } from "./functions/time.js";
import { API_URL } from "./constants.js";
import { getAnimeList } from "./utils/data_manager.js";

import { showSettings } from "./utils/settings_ui.js";
import { showHistory } from "./utils/show_history.js";
import { processQueue } from "./utils/process_queue.js";
import { searchAndDownload } from "./utils/search_download.js";
import { resumeWatch } from "./utils/resume_watch.js";
import { loadHistory } from "./utils/history.js";

import { execSync, spawnSync } from "child_process";
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
			const [animesResult] = await Promise.all([
				getAnimeList(),
				speedTestPromise
			]);
			animes = animesResult;
		} catch (error) {
			spinner.fail(chalk.red("anime listesi alinamadi. internet baglantini kontrol et"));
			return;
		}
		spinner.stop();

		const downloadQueue = loadQueue();
		const config = getConfig();

		if (!config.defaultPlayer) {
			console.clear();
			console.log(chalk.bold.green("hosgeldin, kurulumu halledelim\n"));

			console.log(chalk.cyan("video oynaticin var mi:"));
			const { playerConfirm } = await inquirer.prompt([{
				type: "list",
				name: "playerConfirm",
				message: "vlc ya da mpv var mi sende?",
				choices: [
					{ name: "evet, var", value: "yes" },
					{ name: "hayir, indir (otomatik - winget)", value: "install" },
					{ name: "hayir, tarayiciyi ac", value: "web" }
				]
			}]);

			if (playerConfirm === "install") {
				const { playerToInstall } = await inquirer.prompt([{
					type: "list",
					name: "playerToInstall",
					message: "hangisini kuralim?",
					choices: [
						{ name: "vlc media player", value: "VideoLAN.VLC" },
						{ name: "mpv player", value: "io.mpv.mpv" }
					]
				}]);

				console.log(chalk.yellow(`\n${playerToInstall} kuruluyor...`));
				try {
					spawnSync("winget", ["install", "-e", "--id", playerToInstall], { stdio: "inherit" });
					console.log(chalk.green("\nkurulum bitti"));
				} catch (e) {
					console.log(chalk.red("otomatik kurulum patladi, sen elle indiriver"));
				}
			} else if (playerConfirm === "web") {
				const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
				if (process.platform === 'win32') {
					spawnSync("cmd", ["/c", "start", "https://www.videolan.org/vlc/"], { stdio: 'ignore' });
				}
				console.log(chalk.yellow("tarayiciyi actim, kurup gel"));
				await new Promise(resolve => setTimeout(resolve, 5000));
			}

			console.log("");

			const { player } = await inquirer.prompt([{
				type: "list",
				name: "player",
				message: "hangisini kullansin animely:",
				choices: [
					{ name: "vlc (onerilen)", value: "vlc" },
					{ name: "mpv", value: "mpv" }
				]
			}]);
			config.defaultPlayer = player;
			saveConfig(config);
			console.log(chalk.green("\ntamamdir, basliyoruz"));
			await new Promise(resolve => setTimeout(resolve, 2000));
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

			const history = loadHistory();
			const lastWatched = Object.values(history)
				.sort((a, b) => new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime())[0];

			let resumeAnime = null;
			let nextEpisode = null;

			if (lastWatched && !lastWatched.completed && animes) {
				const found = animes.find(a => a.NAME === lastWatched.name);
				if (found) {
					resumeAnime = found;
					nextEpisode = lastWatched.lastEpisode + 1;
				}
			}

			console.log(chalk.gray(line.repeat(100)));

			const choices = [
				{ name: "anime ara", value: "search" },
				{ name: "izlediklerim", value: "history" },
				{ name: "ayarlar", value: "settings" }
			];

			if (resumeAnime) {
				choices.unshift({
					name: `devam et: ${chalk.cyan(resumeAnime.NAME)} ${chalk.gray(`(${nextEpisode}. bolum)`)}`,
					value: "resume"
				});
			}

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
			} else if (action === "resume") {
				await resumeWatch(resumeAnime, nextEpisode);
			} else if (action === "settings") {
				await showSettings();
			} else if (action === "history") {
				await showHistory();
			} else if (action === "search") {
				try {

					spinner.start("Liste kontrol ediliyor...");
					animes = await getAnimeList();
					spinner.stop();
				} catch (error) {
					spinner.stop();
				}
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