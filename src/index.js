#!/usr/bin/env node
import { line } from "./functions/variables.js";
import { spinner } from "./utils/spinner.js";
import { getConfig, saveConfig } from "./utils/storage/config.js";
import { loadQueue, saveQueue } from "./utils/storage/queue.js";
import { initDiscordRpc, setActivity } from "./utils/discord.js";
import { timeFormat } from "./functions/time.js";
import { API_URL } from "./constants.js";
import { getAnimeList } from "./utils/data_manager.js";
import { telemetry } from "./telemetry/index.js";

import { showSettings } from "./utils/ui/settings_ui.js";
import { showHistory } from "./utils/ui/show_history.js";
import { processQueue } from "./utils/process_queue.js";
import { searchAndDownload } from "./utils/search_download.js";
import { resumeWatch } from "./utils/resume_watch.js";
import { loadHistory } from "./utils/storage/history.js";

import { execSync, spawnSync } from "child_process";
import chalk from "chalk";
import fs from "fs";
import inquirer from "inquirer";
import updateNotifier from "update-notifier";
import { runSpeedTest } from "./utils/speedtest.js";

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
	console.log(chalk.yellow(`\nYeni güncelleme mevcut: ${chalk.dim(notifier.update.current)} -> ${chalk.green(notifier.update.latest)}`));
	console.log(chalk.cyan("Otomatik güncelleme başlatılıyor..."));
	try {
		execSync("npm install -g animely");
		console.log(chalk.green("Güncelleme tamamlandı! Uygulama yeniden başlatılıyor..."));

		const { status } = spawnSync(process.argv[0], process.argv.slice(1), {
			stdio: "inherit"
		});

		process.exit(status ?? 0);
	} catch (e) {
		console.log(chalk.red("Otomatik güncelleme başarısız oldu."));
		console.log(chalk.yellow("Lütfen 'npm install -g animely' komutunu elle çalıştırın."));
	}
}

(async () => {
	try {
		await telemetry.init();
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
			spinner.fail(chalk.red("Anime listesi alınamadı. İnternet bağlantınızı kontrol edin."));
			return;
		}
		spinner.stop();

		const downloadQueue = loadQueue();
		const config = getConfig();

		if (!config.defaultPlayer) {
			console.clear();
			console.log(chalk.bold.green("Animely'e hoş geldiniz. İlk kurulumu tamamlayalım.\n"));

			console.log(chalk.cyan("Medya oynatıcı yapılandırması:"));
			const { playerConfirm } = await inquirer.prompt([{
				type: "list",
				name: "playerConfirm",
				message: "Sisteminizde yüklü bir medya oynatıcı (VLC/MPV) var mı?",
				choices: [
					{ name: "Evet, var", value: "yes" },
					{ name: "Hayır, otomatik indir (Winget)", value: "install" },
					{ name: "Hayır, tarayıcıda aç (VideoLAN.org)", value: "web" }
				]
			}]);

			if (playerConfirm === "install") {
				const { playerToInstall } = await inquirer.prompt([{
					type: "list",
					name: "playerToInstall",
					message: "Hangi oynatıcıyı kurmak istersiniz?",
					choices: [
						{ name: "MPV Player (Önerilen)", value: "io.mpv.mpv" },
						{ name: "VLC Media Player", value: "VideoLAN.VLC" }
					]
				}]);

				console.log(chalk.yellow(`\n${playerToInstall} kuruluyor, lütfen bekleyin...`));
				try {
					spawnSync("winget", ["install", "-e", "--id", playerToInstall], { stdio: "inherit" });
					console.log(chalk.green("\nKurulum başarıyla tamamlandı."));
				} catch (e) {
					console.log(chalk.red("Otomatik kurulum başarısız oldu. Lütfen manuel olarak indirin."));
				}
			} else if (playerConfirm === "web") {
				const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
				if (process.platform === 'win32') {
					spawnSync("cmd", ["/c", "start", "https://www.videolan.org/vlc/"], { stdio: 'ignore' });
				}
				console.log(chalk.yellow("İndirme sayfası tarayıcıda açıldı. Kurulumu tamamlayıp geri dönün."));
				await new Promise(resolve => setTimeout(resolve, 5000));
			}

			console.log("");

			const { player } = await inquirer.prompt([{
				type: "list",
				name: "player",
				message: "Varsayılan oynatıcı olarak hangisi kullanılsın:",
				choices: [
					{ name: "MPV Player (Önerilen - Kaldığı yerden devam desteği)", value: "mpv" },
					{ name: "VLC Player", value: "vlc" }
				]
			}]);
			config.defaultPlayer = player;
			saveConfig(config);
			console.log(chalk.green("\nAyarlar kaydedildi, uygulama başlatılıyor..."));
			await new Promise(resolve => setTimeout(resolve, 2000));
		}

		while (true) {
			console.clear();
			setActivity("Menüde geziniyor");

			console.log([
				`${chalk.gray(timeFormat())} Animely CLI`,
				`${chalk.gray(timeFormat())} GitHub: ${chalk.blue.underline("https://github.com/ewgsta/animely")}`,
			].join("\n"));

			if (downloadQueue.length > 0) {
				console.log(chalk.yellow(`\n  Tamamlanmamış ${downloadQueue.length} indirme görevi var!`));
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
				{ name: "Anime Ara", value: "search" },
				{ name: "İzleme Geçmişi", value: "history" },
				{ name: "Ayarlar", value: "settings" }
			];

			if (resumeAnime) {
				choices.unshift({
					name: `Devam Et: ${chalk.cyan(resumeAnime.NAME)} ${chalk.gray(`(${nextEpisode}. Bölüm)`)}`,
					value: "resume"
				});
			}


			if (downloadQueue.length > 0) {
				choices.unshift({ name: `İndirme Kuyruğunu Başlat (${downloadQueue.length} Bölüm)`, value: "start_queue" });
				choices.unshift({ name: `İndirme Kuyruğunu Temizle`, value: "clear_queue" });
			}

			choices.push(new inquirer.Separator());
			choices.push({ name: "Çıkış", value: "exit" });

			const { action } = await inquirer.prompt([{
				type: "list",
				name: "action",
				message: "Bir işlem seçin:",
				choices: choices
			}]);

			if (action === "exit") {
				console.log(chalk.gray("Görüşmek üzere!"));
				process.exit(0);
			} else if (action === "resume") {
				await resumeWatch(resumeAnime, nextEpisode);
			} else if (action === "settings") {
				await showSettings();
			} else if (action === "history") {
				await showHistory();
			} else if (action === "search") {
				try {

					spinner.start("Liste güncelleniyor...");
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
					message: "İndirme kuyruğunu temizlemek istediğinize emin misiniz?",
					default: false
				}]);

				if (confirm) {
					downloadQueue.length = 0;
					saveQueue(downloadQueue);
					console.log(chalk.green("İndirme kuyruğu başarıyla temizlendi!"));
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
		telemetry.error(error, "main_loop");
		spinner.fail("beklenmeyen bir hata olustu, lutfen daha sonra tekrar deneyiniz.");
		console.error(chalk.gray(`hata detayi: ${error.message}`));
	}
})();