#!/usr/bin/env node
// @ts-check
import { formatName, getLink } from "./functions/episodes.js";
import { timeFormat } from "./functions/time.js";
import { line } from "./functions/variables.js";
import { download } from "./utils/download.js";
import { spinner } from "./utils/spinner.js";
import { getConfig, saveConfig } from "./utils/config.js";
import { loadQueue, saveQueue } from "./utils/queue.js";
import { runWithConcurrency } from "./utils/concurrency.js";
import { openInVlc } from "./utils/vlc.js";
import { openInMpv } from "./utils/mpv.js";
import { initDiscordRpc, setActivity } from "./utils/discord.js";
import { loadHistory, updateHistory } from "./utils/history.js";
import { verifyToken, searchAnime, updateAnilistProgress, authenticate } from "./utils/anilist.js";
import { execSync, spawnSync } from "child_process";
import axios from "axios";
import bytes from "bytes";
import chalk from "chalk";
import fs from "fs";
import inquirer from "inquirer";
import path from "path";
import updateNotifier from "update-notifier";

process.on('SIGINT', () => {
	console.log(chalk.gray("\ngorusmek uzere!"));
	process.exit(0);
});

// güncelleme habercisi yewah
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

/**
 * Fuzzy search function for anime names
 * @param {string} searchTerm 
 * @param {import("./jsdoc.js").Anime[]} animes 
 * @returns {import("./jsdoc.js").Anime[]}
 */
function searchAnimes(searchTerm, animes) {
	const lowerSearchTerm = searchTerm.toLowerCase().trim();
	
	const exactMatches = animes.filter(({ NAME, OTHER_NAMES }) => {
		const lowerName = NAME.toLowerCase();
		const lowerOthers = OTHER_NAMES.map(n => n.toLowerCase());
		return lowerName === lowerSearchTerm || lowerOthers.includes(lowerSearchTerm);
	});

	if (exactMatches.length > 0) {
		return exactMatches;
	}

	const partialMatches = animes.filter(({ NAME, OTHER_NAMES }) => {
		const lowerName = NAME.toLowerCase();
		const lowerOthers = OTHER_NAMES.map(n => n.toLowerCase());
		return lowerName.includes(lowerSearchTerm) || 
			   lowerOthers.some(name => name.includes(lowerSearchTerm));
	});

	if (partialMatches.length > 0) {
		return partialMatches;
	}

	const fuzzyMatches = animes.filter(({ NAME, OTHER_NAMES }) => {
		const allNames = [NAME, ...OTHER_NAMES].map(n => n.toLowerCase());
		return allNames.some(name => {
			const words = lowerSearchTerm.split(" ");
			return words.every(word => name.includes(word));
		});
	});

	return fuzzyMatches;
}

async function showSettings() {
	const config = getConfig();
	
	console.clear();
	console.log(chalk.bold("\nayarlar"));
	console.log(chalk.gray(line.repeat(50)));

	const { action } = await inquirer.prompt([{
		type: "list",
		name: "action",
		message: "degistirmek istediginiz ayari secin:",
		choices: [
			{ name: `varsayilan oynatici (su an: ${chalk.yellow(config.defaultPlayer || "secilmedi")})`, value: "defaultPlayer" },
			{ name: `eszamanli indirme sayisi (su an: ${chalk.yellow(config.maxConcurrent)})`, value: "maxConcurrent" },
			{ name: `indirme klasoru (su an: ${chalk.yellow(config.downloadDir)})`, value: "downloadDir" },
			{ name: `anilist hesabi (su an: ${chalk.yellow(config.anilistUsername || "bagli degil")})`, value: "anilist" },
			new inquirer.Separator(),
			{ name: "geri don", value: "back" }
		]
	}]);

	if (action === "back") return;

	if (action === "anilist") {
		const choices = [
			{ name: "otomatik giris yap (tarayici acilir)", value: "auto" },
			{ name: "manuel token gir", value: "manual" }
		];

		if (config.anilistToken) {
			choices.push({ name: "baglantiyi kaldir", value: "logout" });
		}

		choices.push({ name: "iptal", value: "cancel" });

		const { method } = await inquirer.prompt([{
			type: "list",
			name: "method",
			message: "giris yontemini secin:",
			choices
		}]);

		if (method === "cancel") {
			await showSettings();
			return;
		}

		if (method === "logout") {
			config.anilistToken = undefined;
			config.anilistUsername = undefined;
			saveConfig(config);
			console.log(chalk.yellow("\nanilist baglantisi kaldirildi."));
			await new Promise(resolve => setTimeout(resolve, 1500));
			await showSettings();
			return;
		} else if (method === "auto") {
			try {
				const token = await authenticate();
				spinner.start("token dogrulaniyor...");
				const username = await verifyToken(token);
				spinner.stop();

				if (username) {
					config.anilistToken = token;
					config.anilistUsername = username;
					console.log(chalk.green(`\nbasariyla giris yapildi! hosgeldin ${username}`));
				} else {
					console.log(chalk.red("\ntoken alindi fakat dogrulanamadi."));
				}
			} catch (error) {
				console.log(chalk.red("\ngiris yapilamadi: " + error.message));
			}
		} else if (method === "manual") {
			console.log(chalk.cyan("\nanilist token almak icin: https://anilist.co/api/v2/oauth/authorize?client_id=33256&response_type=token"));
			const { token } = await inquirer.prompt([{
				type: "input",
				name: "token",
				message: "anilist access token'inizi girin:"
			}]);

			if (token.trim()) {
				spinner.start("token dogrulaniyor...");
				const username = await verifyToken(token.trim());
				spinner.stop();

				if (username) {
					config.anilistToken = token.trim();
					config.anilistUsername = username;
					console.log(chalk.green(`\nbasariyla giris yapildi! hosgeldin ${username}`));
				} else {
					console.log(chalk.red("\ngecersiz token!"));
				}
			}
		}
		await new Promise(resolve => setTimeout(resolve, 2000));
	} else if (action === "defaultPlayer") {
		const { player } = await inquirer.prompt([{
			type: "list",
			name: "player",
			message: "varsayilan oynaticiyi secin:",
			choices: [
				{ name: "VLC Media Player", value: "vlc" },
				{ name: "MPV Player", value: "mpv" }
			],
			default: config.defaultPlayer || "vlc"
		}]);
		config.defaultPlayer = player;
	} else if (action === "maxConcurrent") {
		const { limit } = await inquirer.prompt([{
			type: "number",
			name: "limit",
			message: "yeni eszamanli indirme sayisi (1-10 arasi):",
			default: config.maxConcurrent,
			validate: (input) => (input > 0 && input <= 10) ? true : "lutfen 1 ile 10 arasinda bir sayi girin."
		}]);
		config.maxConcurrent = limit;
	} else if (action === "downloadDir") {
		const { dir } = await inquirer.prompt([{
			type: "input",
			name: "dir",
			message: "yeni indirme klasoru:",
			default: config.downloadDir,
			validate: (input) => input.trim() !== "" ? true : "gecerli bir klasor yolu girin."
		}]);
		config.downloadDir = dir;
	}

	saveConfig(config);
	console.log(chalk.green("\nayarlar basariyla kaydedildi!"));
	await new Promise(resolve => setTimeout(resolve, 1000));
	await showSettings();
}

async function showHistory() {
	const history = loadHistory();
	const items = Object.values(history);
	
	const completed = items.filter(i => i.completed);
	const inProgress = items.filter(i => !i.completed);

	console.clear();
	console.log(chalk.bold("\nizlediklerim"));
	console.log(chalk.gray(line.repeat(50)));

	const { type } = await inquirer.prompt([{
		type: "list",
		name: "type",
		message: "hangi listeyi goruntulemek istersiniz?",
		choices: [
			{ name: `devam edenler (${inProgress.length})`, value: "progress" },
			{ name: `tamamlananlar (${completed.length})`, value: "completed" },
			new inquirer.Separator(),
			{ name: "geri don", value: "back" }
		]
	}]);

	if (type === "back") return;

	if (type === "completed") {
		console.clear();
		console.log(chalk.green("\ntamamlanan animeler"));
		console.log(chalk.gray(line.repeat(50)));
		
		if (completed.length === 0) {
			console.log(chalk.yellow("henuz tamamlanmis bir anime yok."));
		} else {
			completed.forEach(anime => {
				console.log(`${chalk.cyan(anime.name)} - ${chalk.gray(new Date(anime.lastWatchedAt).toLocaleDateString())}`);
			});
		}
		
		await inquirer.prompt([{ type: "input", name: "dummy", message: "geri donmek icin enter'a basin..." }]);
		await showHistory();
	} else if (type === "progress") {
		if (inProgress.length === 0) {
			console.log(chalk.yellow("\nhenuz izlenen bir anime yok."));
			await new Promise(resolve => setTimeout(resolve, 1500));
			await showHistory();
			return;
		}

		const { anime } = await inquirer.prompt([{
			type: "list",
			name: "anime",
			message: "detaylarini gormek istediginiz animeyi secin:",
			choices: [
				...inProgress.map(i => ({
					name: `${i.name} ${chalk.gray(`(son izlenen: ${i.lastEpisode}. bolum)`)}`,
					value: i
				})),
				new inquirer.Separator(),
				{ name: "geri don", value: "back" }
			]
		}]);

		if (anime === "back") {
			await showHistory();
			return;
		}

		console.log(chalk.cyan(`\n${anime.name}`));
		console.log(chalk.gray(`son izlenen bolum: ${anime.lastEpisode}`));
		console.log(chalk.gray(`toplam bolum: ${anime.totalEpisodes}`));
		console.log(chalk.gray(`son izleme tarihi: ${new Date(anime.lastWatchedAt).toLocaleString()}`));
		
		await inquirer.prompt([{ type: "input", name: "dummy", message: "geri donmek icin enter'a basin..." }]);
		await showHistory();
	}
}

/**
 * @param {import("./utils/queue.js").QueueItem[]} queue
 */
async function processQueue(queue) {
	console.clear();
	const totalEpisodes = queue.length;
	const estimatedSizeMB = totalEpisodes * 250; // 250MB estimate
	const estimatedSizeGB = (estimatedSizeMB / 1024).toFixed(2);
	
	const estimatedSeconds = estimatedSizeMB / 4.375;
	const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

	console.log(chalk.green(`\nindirme kuyrugu`));
	console.log(chalk.gray(`toplam bolum: ${totalEpisodes}`));
	console.log(chalk.gray(`tahmini boyut: ~${estimatedSizeGB} gb`));
	console.log(chalk.gray(`tahmini sure: ~${estimatedMinutes} dk (35 mbps ile)`));

	const { confirm } = await inquirer.prompt([{
		type: "confirm",
		name: "confirm",
		message: "indirmeyi baslatmak istiyor musunuz",
		default: true
	}]);

	if (!confirm) return;

	const config = getConfig();
	
	// Ensure directories exist
	const dirs = new Set(queue.map(item => item.dirPath));
	dirs.forEach(dir => {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	});

	console.log(chalk.cyan(`\n${totalEpisodes} bolum indirilecek. eszamanli indirme: ${config.maxConcurrent}`));

	const progressMap = new Map();
	// Initialize progress
	queue.forEach((item) => {
		const key = `${item.safeAnimeName}-${item.episode.episode_number}`;
		progressMap.set(key, { 
			percent: 0, 
			status: 'bekliyor', 
			name: `${item.animeName} - ${item.episode.episode_number}`,
			speed: 0,
			eta: 0
		});
	});

	let lastLineCount = 0;

	const printProgress = () => {
		const activeDownloads = Array.from(progressMap.entries())
			.filter(([_, data]) => data.status === 'indiriliyor');
			
		const output = activeDownloads.map(([_, data]) => {
			const progressBar = "█".repeat(Math.floor(parseFloat(data.percent) / 5)) + "░".repeat(20 - Math.floor(parseFloat(data.percent) / 5));
			// Truncate name if too long
			const name = data.name.length > 25 ? data.name.substring(0, 22) + "..." : data.name.padEnd(25);
			
			// Format ETA
			const eta = data.eta || 0;
			const h = Math.floor(eta / 3600);
			const m = Math.floor((eta % 3600) / 60);
			const s = eta % 60;
			const etaStr = h > 0 ? `${h}s ${m}dk ${s}sn` : m > 0 ? `${m}dk ${s}sn` : `${s}sn`;
			const speedStr = data.speed ? bytes(data.speed) + '/s' : '0B/s';
			const downloadedStr = data.downloaded ? bytes(data.downloaded) : '0B';
			const totalStr = data.total ? bytes(data.total) : '0B';

			return `${name}: [${progressBar}] %${data.percent} (${downloadedStr} / ${totalStr}) - ${speedStr} - kalan: ${etaStr}`;
		}).join("\n");
		
		if (lastLineCount > 0) {
			process.stdout.moveCursor(0, -lastLineCount);
			process.stdout.cursorTo(0);
			process.stdout.clearScreenDown();
		}

		if (activeDownloads.length > 0) {
			console.log(output);
			lastLineCount = activeDownloads.length;
		} else {
			lastLineCount = 0;
		}
	};

	// Reserve space for progress bars
	if (queue.length > 0) {
		console.log("\n".repeat(Math.min(queue.length, config.maxConcurrent)));
	}

	const tasks = queue.map((item) => async () => {
		const key = `${item.safeAnimeName}-${item.episode.episode_number}`;
		const downloadPath = path.join(item.dirPath, `${item.safeAnimeName} - ${item.episode.episode_number}`);
		
		if (!item.episode.link) {
			 progressMap.set(key, { ...progressMap.get(key), status: 'hata', percent: 0 });
			 return;
		}

		try {
			progressMap.set(key, { ...progressMap.get(key), status: 'indiriliyor', percent: 0 });
			
			await download(item.episode.link, downloadPath, { 
				silent: true,
				onProgress: (data) => {
					progressMap.set(key, { 
						...progressMap.get(key), 
						status: 'indiriliyor', 
						percent: data.percent,
						speed: data.speed,
						eta: data.eta,
						downloaded: data.downloaded,
						total: data.total
					});
					printProgress();
				}
			});
			
			progressMap.set(key, { ...progressMap.get(key), status: 'tamamlandi', percent: 100 });
			printProgress();

			// Remove from queue and save
			const index = queue.indexOf(item);
			if (index > -1) {
				queue.splice(index, 1);
				saveQueue(queue);
			}
		} catch (error) {
			progressMap.set(key, { ...progressMap.get(key), status: 'hata', percent: 0 });
			printProgress();
		}
	});

	await runWithConcurrency(tasks, config.maxConcurrent);
	spinner.succeed(chalk.bold("kuyruk tamamlandi!"));
	await new Promise(resolve => setTimeout(resolve, 2000));
}

/**
 * @param {import("./jsdoc.js").Anime[]} animes 
 * @param {import("./utils/queue.js").QueueItem[]} downloadQueue
 */
async function searchAndDownload(animes, downloadQueue) {
	let selectedAnime;
	let episodes;

	while (true) {
		console.clear();
		const { name } = await inquirer.prompt([{
			type: "input",
			name: "name",
			message: "hangi animeyi aramak istiyorsunuz (iptal icin 'iptal' yaziniz):",
			validate: (input) => {
				if (!input || input.trim() === "") {
					return "lutfen bir anime adi giriniz.";
				}
				return true;
			},
		}]);

		if (name.toLowerCase() === "iptal") return;

		spinner.start();

		const foundAnimes = searchAnimes(name, animes);

		if (foundAnimes.length === 0) {
			spinner.fail(chalk.gray("uzgunuz, aradiginiz anime bulunamadi."));
			await new Promise(resolve => setTimeout(resolve, 1500));
			continue;
		}

		if (foundAnimes.length === 1) {
			selectedAnime = foundAnimes[0];
		} else {
			spinner.stop();
			
			console.log(chalk.yellow(`\n${foundAnimes.length} adet anime bulundu:`));
			
			const { anime } = await inquirer.prompt([{
				type: "list",
				name: "anime",
				message: "hangi animeyi secmek istiyorsunuz?",
				choices: foundAnimes.map(anime => ({
					name: `${anime.NAME} ${chalk.gray(`(sezon ${anime.SEASON_NUMBER}, ${anime.TOTAL_EPISODES} bolum)`)}`,
					value: anime,
				})),
			}]);
			
			selectedAnime = anime;
			spinner.start();
		}

		/**
		* @typedef {{ episodes: import("./jsdoc.js").Episode[] }} Response
		* @type {import("axios").AxiosResponse<Response>}
		*/
		let httpData;
		try {
			httpData = await axios.post("https://animely.net/api/searchAnime", { payload: selectedAnime.SLUG });
		} catch (error) {
			spinner.fail(chalk.red("anime bolumleri alinamadi. lutfen daha sonra tekrar deneyin."));
			console.error(chalk.gray(`hata detayi: ${error.message}`));
			await new Promise(resolve => setTimeout(resolve, 2000));
			continue;
		}

		episodes = httpData.data.episodes;

		if (!episodes || episodes.length === 0) {
			spinner.fail(chalk.gray("bu anime icin henuz bolum bulunamadi."));
			await new Promise(resolve => setTimeout(resolve, 1500));
			continue;
		}

		spinner.stop();
		break;
	}

	console.clear();
	console.log(chalk.green(`\n${selectedAnime.NAME} secildi!`));
	console.log(chalk.gray(`toplam ${episodes.length} bolum mevcut`));

	while (true) {
		const { action } = await inquirer.prompt([{
			type: "list",
			name: "action",
			message: "ne yapmak istersin?",
			choices: [
				{ name: "izle", value: "watch" },
				{ name: "indir", value: "download" },
				{ name: "geri don", value: "back" }
			]
		}]);

		if (action === "back") return;

		let selectedEpisodes = [];

		if (action === "watch") {
		while (true) {
			console.clear();
			console.log(chalk.green(`\n${selectedAnime.NAME} - izle`));

			const { episode } = await inquirer.prompt([{
				type: "list",
				name: "episode",
				message: "izlemek istediginiz bolumu secin:",
				pageSize: 15,
				loop: false,
				choices: [
					{ name: "geri don", value: "back" },
					new inquirer.Separator(),
					...episodes.map(({ id, episode_number, type, fansub, backblaze_link, watch_link_1, watch_link_2, watch_link_3 }) => {
						const links = [backblaze_link, watch_link_1, watch_link_2, watch_link_3];
						const hasValidLink = !links.every((link) => !link || link.trim() === "");
						
						let fansubText = "";
						if (fansub) {
							if (typeof fansub === "string") {
								fansubText = fansub;
							} else if (typeof fansub === "object") {
								/** @type {any} */
								const fansubObj = fansub;
								fansubText = fansubObj.name || fansubObj.title || JSON.stringify(fansub);
							} else {
								fansubText = String(fansub);
							}
						}

						return {
							name: formatName(episode_number, type),
							description: fansubText,
							value: {
								id: id,
								episode_number: episode_number,
								link: getLink(links),
							},
							disabled: !hasValidLink,
						};
					})
				],
			}]);

			if (episode === "back") break;

			if (!episode.link) {
				console.log(chalk.red("secilen bolum icin izleme linki bulunamadi."));
				await new Promise(resolve => setTimeout(resolve, 1500));
				continue;
			}

			try {
				const config = getConfig();
				const player = config.defaultPlayer || "vlc";
				
				console.clear();
				console.log(chalk.green(`${selectedAnime.NAME} — ${episode.episode_number}. bolum ${player}'de aciliyor...`));
				
				setActivity(`${selectedAnime.NAME}`, `${episode.episode_number}. Bölüm İzleniyor`);

				if (player === "mpv") {
					await openInMpv(episode.link);
				} else {
					await openInVlc(episode.link);
				}
				
				setActivity("Ana menüde takılıyor");

				const { watched } = await inquirer.prompt([{
					type: "confirm",
					name: "watched",
					message: "bolumu izlendi olarak isaretlemek ister misiniz?",
					default: true
				}]);

				if (watched) {
					const totalEpisodes = episodes.length;
					const epNum = typeof episode.episode_number === "number" ? episode.episode_number : parseInt(episode.episode_number);
					
					// Update local history
					let anilistId;
					const history = loadHistory();
					if (history[selectedAnime.NAME]) {
						anilistId = history[selectedAnime.NAME].anilistId;
					}

					// If we have token but no ID, search for it
					if (config.anilistToken && !anilistId) {
						spinner.start("anilist'te anime araniyor...");
						anilistId = await searchAnime(selectedAnime.NAME);
						spinner.stop();
					}

					updateHistory(selectedAnime.NAME, epNum, totalEpisodes, anilistId);
					console.log(chalk.green("gecmis guncellendi!"));

					// Update AniList if possible
					if (config.anilistToken && anilistId) {
						spinner.start("anilist guncelleniyor...");
						const success = await updateAnilistProgress(anilistId, epNum, epNum >= totalEpisodes);
						spinner.stop();
						if (success) {
							console.log(chalk.green("anilist basariyla guncellendi!"));
						}
					}
					
					await new Promise(resolve => setTimeout(resolve, 1500));
				}
			} catch (error) {
				const config = getConfig();
				console.error(chalk.red(`${config.defaultPlayer || "vlc"} baslatilamadi: ${error.message}`));
				await new Promise(resolve => setTimeout(resolve, 2000));
			}
		}
	} else if (action === "download") {
		setActivity(`${selectedAnime.NAME}`, "Bölüm İndiriyor");
		console.clear();
		console.log(chalk.green(`\n${selectedAnime.NAME} - indir`));

		const { selectionMethod } = await inquirer.prompt([{
			type: "list",
			name: "selectionMethod",
			message: "bolumleri nasil secmek istersiniz?",
			choices: [
				{ name: "listeden sec (tek tek)", value: "list" },
				{ name: "aralik gir (orn: 1-12, 15)", value: "range" },
				{ name: "tumunu indir", value: "all" },
				{ name: "geri don", value: "back" }
			]
		}]);

		if (selectionMethod === "back") continue;

		if (selectionMethod === "list") {
			console.clear();
			console.log(chalk.green(`\n${selectedAnime.NAME} - bolum secimi`));

			const { episodes: selected } = await inquirer.prompt([{
				type: "checkbox",
				name: "episodes",
				message: "lutfen indirmek istediginiz bolumleri secin (bosluk ile secip enter ile onaylayin):",
				choices: episodes.map(({ id, episode_number, type, fansub, backblaze_link, watch_link_1, watch_link_2, watch_link_3 }) => {
					const links = [backblaze_link, watch_link_1, watch_link_2, watch_link_3];
					const hasValidLink = !links.every((link) => !link || link.trim() === "");
					
					if (typeof episode_number === "object") {
						console.warn(`⚠️  bolum ${id} nesne tipinde bolum numarasina sahip:`, episode_number);
					}

					let fansubText = "";
					if (fansub) {
						if (typeof fansub === "string") {
							fansubText = fansub;
						} else if (typeof fansub === "object") {
							/** @type {any} */
							const fansubObj = fansub;
							fansubText = fansubObj.name || fansubObj.title || JSON.stringify(fansub);
						} else {
							fansubText = String(fansub);
						}
					}

					return {
						name: formatName(episode_number, type),
						description: fansubText,
						value: {
							id: id,
							episode_number: episode_number,
							link: getLink(links),
						},
						disabled: !hasValidLink,
					};
				}),
			}]);
			selectedEpisodes = selected;
		} else if (selectionMethod === "range") {
			console.clear();
			console.log(chalk.green(`\n${selectedAnime.NAME} - aralik secimi`));

			const { range } = await inquirer.prompt([{
				type: "input",
				name: "range",
				message: "bolum araligini giriniz (orn: 1-12, 15, 20-25):",
				validate: (input) => {
					if (!input || input.trim() === "") return "lutfen gecerli bir aralik giriniz.";
					return true;
				}
			}]);

			const parts = range.split(",").map(p => p.trim());
			const numbers = new Set();

			for (const part of parts) {
				if (part.includes("-")) {
					const [start, end] = part.split("-").map(n => parseInt(n.trim(), 10));
					if (!isNaN(start) && !isNaN(end)) {
						for (let i = start; i <= end; i++) {
							numbers.add(i);
						}
					}
				} else {
					const num = parseInt(part, 10);
					if (!isNaN(num)) {
						numbers.add(num);
					}
				}
			}

			selectedEpisodes = episodes.filter(ep => {
				const epNum = typeof ep.episode_number === "number" ? ep.episode_number : parseInt(ep.episode_number, 10);
				return numbers.has(epNum);
			}).map(ep => {
				const links = [ep.backblaze_link, ep.watch_link_1, ep.watch_link_2, ep.watch_link_3];
				return {
					id: ep.id,
					episode_number: ep.episode_number,
					link: getLink(links)
				};
			});
		} else if (selectionMethod === "all") {
			selectedEpisodes = episodes.map(ep => {
				const links = [ep.backblaze_link, ep.watch_link_1, ep.watch_link_2, ep.watch_link_3];
				return {
					id: ep.id,
					episode_number: ep.episode_number,
					link: getLink(links)
				};
			});
		}

		if (!selectedEpisodes || selectedEpisodes.length === 0) {
			console.log(chalk.yellow("hicbir bolum secilmedi."));
			continue;
		}

	console.clear();

	const { downloadAction } = await inquirer.prompt([{
		type: "list",
		name: "downloadAction",
		message: "ne yapmak istersiniz",
		choices: [
			{ name: "kuyruga ekle", value: "queue" },
			{ name: "hemen indir", value: "now" }
		]
	}]);

	const config = getConfig();
	const safeAnimeName = selectedAnime.NAME.replace(/[<>:"/\\|?*]/g, "").trim();
	const dirPath = path.join(config.downloadDir, safeAnimeName);

	if (downloadAction === "queue") {
		selectedEpisodes.forEach(ep => {
			downloadQueue.push({
				animeName: selectedAnime.NAME,
				episode: ep,
				dirPath: dirPath,
				safeAnimeName: safeAnimeName
			});
		});
		saveQueue(downloadQueue);
		console.log(chalk.green(`${selectedEpisodes.length} bolum kuyruga eklendi.`));
		await new Promise(resolve => setTimeout(resolve, 1000));
		return;
	}

	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}

	if (selectedEpisodes.length > 1) {
		console.log(chalk.cyan(`\n${selectedEpisodes.length} bolum secildi. ayni anda en fazla ${config.maxConcurrent} indirme yapilacak.`));
	}

	const progressMap = new Map();
	selectedEpisodes.forEach(ep => {
		progressMap.set(ep.episode_number, { percent: 0, status: 'bekliyor' });
	});

	const printProgress = () => {
		
		const activeDownloads = Array.from(progressMap.entries())
			.filter(([_, data]) => data.status === 'indiriliyor');
			
		const output = activeDownloads.map(([ep, data]) => {
			const progressBar = "█".repeat(Math.floor(parseFloat(data.percent) / 5)) + "░".repeat(20 - Math.floor(parseFloat(data.percent) / 5));
			
			// ETA Format
			const eta = data.eta || 0;
			const h = Math.floor(eta / 3600);
			const m = Math.floor((eta % 3600) / 60);
			const s = eta % 60;
			const etaStr = h > 0 ? `${h}s ${m}dk ${s}sn` : m > 0 ? `${m}dk ${s}sn` : `${s}sn`;
			const speedStr = data.speed ? bytes(data.speed) + '/s' : '0B/s';
			const downloadedStr = data.downloaded ? bytes(data.downloaded) : '0B';
			const totalStr = data.total ? bytes(data.total) : '0B';

			return `bolum ${ep}: [${progressBar}] %${data.percent} (${downloadedStr} / ${totalStr}) - ${speedStr} - kalan: ${etaStr}`;
		}).join("\n");
		
		const lines = activeDownloads.length;
		if (lines > 0) {
			process.stdout.moveCursor(0, -lines);
			process.stdout.cursorTo(0);
			process.stdout.clearScreenDown();
			console.log(output);
		}
	};
	
	if (selectedEpisodes.length > 1) {
		console.log("\n".repeat(Math.min(selectedEpisodes.length, config.maxConcurrent))); 
	}

	const tasks = selectedEpisodes.map((episode) => async () => {
		if (!episode.link) {
			console.log(chalk.red(`${episode.episode_number}. bolum icin indirme linki bulunamadi.`));
			return;
		}

		const downloadPath = path.join(dirPath, `${safeAnimeName} - ${episode.episode_number}`);
		const isSingle = selectedEpisodes.length === 1;

		try {
			if (!isSingle) {
				progressMap.set(episode.episode_number, { percent: 0, status: 'indiriliyor' });
			}
			
			await download(episode.link, downloadPath, { 
				silent: !isSingle,
				onProgress: (data) => {
					if (!isSingle) {
						progressMap.set(episode.episode_number, { 
							percent: data.percent, 
							status: 'indiriliyor',
							speed: data.speed,
							eta: data.eta,
							downloaded: data.downloaded,
							total: data.total
						});
						printProgress();
					}
				}
			});
			
			if (!isSingle) {
				progressMap.set(episode.episode_number, { percent: 100, status: 'tamamlandi' });
				printProgress();
			} else {
				spinner.succeed(chalk.bold(`${selectedAnime.NAME} — ${episode.episode_number}. bolum basariyla indirildi.`));
			}
		} catch (error) {
			if (!isSingle) {
				progressMap.set(episode.episode_number, { percent: 0, status: 'hata' });
				printProgress();
			} else {
				spinner.fail(chalk.red("indirme sirasinda bir hata olustu."));
				console.error(chalk.gray(`hata detayi: ${error.message}`));
			}
		}
	});

	await runWithConcurrency(tasks, config.maxConcurrent);

	if (selectedEpisodes.length > 1) {
		spinner.succeed(chalk.bold("tum indirmeler tamamlandi!"));
	}
	return;
		}
	}
}

(async () => {
	try {
		await initDiscordRpc();
		spinner.start();

		/** @type {import("./jsdoc.js").Anime[]} */
		let animes;
		try {
			const response = await axios.get("https://animely.net/api/animes");
			animes = response.data;
		} catch (error) {
			spinner.fail(chalk.red("anime listesi alinamadi. internet baglantini kontrol et"));
			return;
		}
		spinner.stop();

		const downloadQueue = loadQueue();
		const config = getConfig();

		// First run player selection
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

			/** @type {any[]} */
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
			
			console.log(""); // boşch
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