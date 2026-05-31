#!/usr/bin/env node
import { spinner } from "./utils/spinner.js";
import { getConfig, saveConfig } from "./utils/storage/config.js";
import { loadQueue, saveQueue } from "./utils/storage/queue.js";
import { initDiscordRpc, setActivity } from "./utils/discord.js";
import { sources, getSourceById, getSourcesByLanguage, getDefaultSourceForLanguage } from "./sources/index.js";
import { infoBox } from "./utils/ui/box.js";

import { showSettings } from "./utils/ui/settings_ui.js";
import { showHistory } from "./utils/ui/show_history.js";
import { processQueue } from "./utils/process_queue.js";
import { searchAndDownload } from "./utils/search_download.js";
import { resumeWatch } from "./utils/resume_watch.js";
import { loadHistory } from "./utils/storage/history.js";
import { t, setLanguage } from "./i18n/index.js";

import { execSync, spawnSync } from "child_process";
import chalk from "chalk";
import fs from "fs";
import inquirer from "inquirer";
import updateNotifier from "update-notifier";
import { runSpeedTest } from "./utils/speedtest.js";

process.on('SIGINT', () => {
	console.log(chalk.gray("\n" + t("app.goodbye")));
	process.exit(0);
});

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

process.stdout.write(`\x1b]0;Animely CLI | v${pkg.version}\x07`);

const notifier = updateNotifier({
	pkg,
	updateCheckInterval: 0
});

if (notifier.update) {
	console.log(chalk.yellow(`\n${t("update.available", { current: notifier.update.current, latest: notifier.update.latest })}`));
	console.log(chalk.cyan(t("update.starting")));
	try {
		execSync("npm install -g animely");
		console.log(chalk.green(t("update.completed")));

		const { status } = spawnSync(process.argv[0], process.argv.slice(1), {
			stdio: "inherit"
		});

		process.exit(status ?? 0);
	} catch (e) {
		console.log(chalk.red(t("update.failed")));
		console.log(chalk.yellow(t("update.manualInstall")));
	}
}

(async () => {
	try {
		await initDiscordRpc();

		const speedTestPromise = runSpeedTest();

		spinner.start();

		const config = getConfig();
		
		// Dil ayarını yükle
		if (config.language) {
			setLanguage(config.language);
		}
		
		// Dile göre kaynakları filtrele ve mevcut kaynağı kontrol et
		const currentLang = config.language || "tr";
		const availableSources = getSourcesByLanguage(currentLang);
		let currentSource = getSourceById(config.defaultSource);
		
		// Eğer mevcut kaynak bu dilde yoksa, varsayılan kaynağı kullan
		if (!currentSource || currentSource.language !== currentLang) {
			currentSource = availableSources[0] || sources[0];
			config.defaultSource = currentSource.id;
			saveConfig(config);
		}

		let animes = null;
		if (currentSource.supportsLocalSearch && currentSource.getAnimeList) {
			try {
				const [animesResult] = await Promise.all([
					currentSource.getAnimeList(),
					speedTestPromise
				]);
				animes = animesResult;
			} catch (error) {
				spinner.fail(chalk.red(t("errors.animeListFailed")));
				return;
			}
		} else {
			await speedTestPromise;
		}
		spinner.stop();

		const downloadQueue = loadQueue();

		// İlk kurulum - önce dil seçimi
		if (!config.language) {
			console.clear();
			console.log(chalk.bold.green("Animely'e hoş geldiniz / Welcome to Animely\n"));

			const { language } = await inquirer.prompt([{
				type: "list",
				name: "language",
				message: "Dil seçin / Select language:",
				choices: [
					{ name: "Türkçe", value: "tr" },
					{ name: "English", value: "en" }
				]
			}]);

			config.language = language;
			setLanguage(language);
			
			// Dile göre varsayılan kaynağı ayarla
			const defaultSource = getDefaultSourceForLanguage(language);
			config.defaultSource = defaultSource.id;
			
			saveConfig(config);
		}

		if (!config.defaultPlayer) {
			console.clear();
			console.log(chalk.bold.green(t("setup.welcome") + "\n"));

			console.log(chalk.cyan(t("setup.playerConfig")));
			const { playerConfirm } = await inquirer.prompt([{
				type: "list",
				name: "playerConfirm",
				message: t("setup.playerQuestion"),
				choices: [
					{ name: t("setup.playerYes"), value: "yes" },
					{ name: t("setup.playerInstall"), value: "install" },
					{ name: t("setup.playerWeb"), value: "web" }
				]
			}]);

			if (playerConfirm === "install") {
				const { playerToInstall } = await inquirer.prompt([{
					type: "list",
					name: "playerToInstall",
					message: t("setup.playerSelect"),
					choices: [
						{ name: t("setup.mpvRecommended"), value: "io.mpv.mpv" },
						{ name: t("setup.vlcPlayer"), value: "VideoLAN.VLC" }
					]
				}]);

				console.log(chalk.yellow(`\n${t("setup.installing", { player: playerToInstall })}`));
				try {
					spawnSync("winget", ["install", "-e", "--id", playerToInstall], { stdio: "inherit" });
					console.log(chalk.green("\n" + t("setup.installSuccess")));
				} catch (e) {
					console.log(chalk.red(t("setup.installFailed")));
				}
			} else if (playerConfirm === "web") {
				const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
				if (process.platform === 'win32') {
					spawnSync("cmd", ["/c", "start", "https://www.videolan.org/vlc/"], { stdio: 'ignore' });
				}
				console.log(chalk.yellow(t("setup.webOpened")));
				await new Promise(resolve => setTimeout(resolve, 5000));
			}

			console.log("");

			const { player } = await inquirer.prompt([{
				type: "list",
				name: "player",
				message: t("setup.defaultPlayerPrompt"),
				choices: [
					{ name: t("setup.mpvWithResume"), value: "mpv" },
					{ name: t("setup.vlcPlayer"), value: "vlc" }
				]
			}]);
			config.defaultPlayer = player;
			saveConfig(config);
			console.log(chalk.green("\n" + t("setup.settingsSaved")));
			await new Promise(resolve => setTimeout(resolve, 2000));
		}

		while (true) {
			console.clear();
			setActivity(t("menu.browsingMenu"));

			const currentConfig = getConfig();
			const currentLangInLoop = currentConfig.language || "tr";
			const availableSourcesInLoop = getSourcesByLanguage(currentLangInLoop);
			let activeSource = getSourceById(currentConfig.defaultSource);
			
			// Kaynak dil uyumsuzluğu kontrolü
			if (!activeSource || activeSource.language !== currentLangInLoop) {
				activeSource = availableSourcesInLoop[0] || sources[0];
			}

			console.log(chalk.bgCyan.black(` ${t("app.title")} `) + chalk.gray(` v${pkg.version} | ${activeSource.name}`));

			if (downloadQueue.length > 0) {
				console.log("");
				infoBox(t("menu.incompleteDownloads", { count: downloadQueue.length }));
			}

			const history = loadHistory();
			const lastWatched = Object.values(history)
				.sort((a, b) => new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime())[0];

			let resumeAnime = null;
			let nextEpisode = null;

			if (lastWatched && !lastWatched.completed && animes && activeSource.id === "animely") {
				const found = animes.find(a => a.NAME === lastWatched.name);
				if (found) {
					resumeAnime = found;
					nextEpisode = lastWatched.lastEpisode + 1;
				}
			}

			console.log(""); 

			const choices = [
				{ name: t("menu.searchAnime"), value: "search" },
				{ name: t("menu.watchHistory"), value: "history" },
				{ name: t("menu.settings"), value: "settings" }
			];

			if (resumeAnime) {
				choices.unshift({
					name: t("menu.resume", { name: chalk.cyan(resumeAnime.NAME), episode: nextEpisode }),
					value: "resume"
				});
			}


			if (downloadQueue.length > 0) {
				choices.unshift({ name: t("menu.startQueue", { count: downloadQueue.length }), value: "start_queue" });
				choices.unshift({ name: t("menu.clearQueue"), value: "clear_queue" });
			}

			choices.push(new inquirer.Separator());
			choices.push({ name: t("menu.exit"), value: "exit" });

			const { action } = await inquirer.prompt([{
				type: "list",
				name: "action",
				message: t("menu.selectAction"),
				loop: false,
				choices: choices
			}]);

			if (action === "exit") {
				console.log(chalk.gray(t("app.goodbye")));
				process.exit(0);
			} else if (action === "resume") {
				await resumeWatch(resumeAnime, nextEpisode);
			} else if (action === "settings") {
				await showSettings();
			} else if (action === "history") {
				await showHistory();
			} else if (action === "search") {
				const searchConfig = getConfig();
				const searchSource = getSourceById(searchConfig.defaultSource) || sources[0];

				if (searchSource.supportsLocalSearch && searchSource.getAnimeList) {
					try {
						spinner.start(t("spinner.listUpdating"));
						animes = await searchSource.getAnimeList();
						spinner.stop();
					} catch (error) {
						spinner.stop();
					}
				}
				await searchAndDownload(animes, downloadQueue, searchSource);
			} else if (action === "start_queue") {
				await processQueue(downloadQueue);
			} else if (action === "clear_queue") {
				const { confirm } = await inquirer.prompt([{
					type: "confirm",
					name: "confirm",
					message: t("queue.confirmClear"),
					default: false
				}]);

				if (confirm) {
					downloadQueue.length = 0;
					saveQueue(downloadQueue);
					console.log(chalk.green(t("queue.cleared")));
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			}

			console.log("");
		}

	} catch (error) {
		if (error.message && error.message.includes("User force closed")) {
			console.log(chalk.gray("\n" + t("app.goodbye")));
			process.exit(0);
		}
		spinner.fail(t("app.unexpectedError"));
		console.error(chalk.gray(t("app.errorDetail", { message: error.message })));
	}
})();
