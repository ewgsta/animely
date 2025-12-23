import inquirer from "inquirer";
import chalk from "chalk";
import axios from "axios";
import fs from "fs";
import path from "path";
import { getConfig } from "./storage/config.js";
import { saveQueue } from "./storage/queue.js";
import { searchAnimes } from "./search.js";
import { formatName, getLink } from "../functions/episodes.js";
import { openInVlc } from "./players/vlc.js";
import { openInMpv } from "./players/mpv.js";
import { setActivity, setWatchingActivity } from "./discord.js";
import { updateHistory, loadHistory } from "./storage/history.js";
import { searchAnime, updateAnilistProgress } from "./anilist.js";
import { spinner } from "./spinner.js";
import { dl } from "./download/download.js";
import { batch } from "./download/concurrency.js";
import { ProgressBar } from "./download/progress.js";
import { API_URL } from "../constants.js";
import { telemetry } from "../telemetry/index.js";
import { commandExists } from "./system.js";

/**
 * @param {import("../jsdoc.js").Anime[]} animes 
 * @param {import("./storage/queue.js").QueueItem[]} downloadQueue
 */
export async function searchAndDownload(animes, downloadQueue) {
    let selectedAnime;
    let episodes;

    while (true) {
        console.clear();
        const { name } = await inquirer.prompt([{
            type: "input",
            name: "name",
            message: "Aramak istediğiniz animenin adını girin (İptal için 'iptal' yazın):",
            validate: (input) => {
                if (!input || input.trim() === "") {
                    return "Lütfen geçerli bir anime adı giriniz.";
                }
                return true;
            },
        }]);

        if (name.toLowerCase() === "iptal") return;

        spinner.start();

        const foundAnimes = searchAnimes(name, animes);

        if (foundAnimes.length === 0) {
            spinner.fail(chalk.gray("Üzgünüz, aradığınız kriterlere uygun anime bulunamadı."));
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
                message: "Hangi animeyi seçmek istersiniz?",
                choices: [
                    { name: "Geri Dön", value: "back" },
                    new inquirer.Separator(),
                    ...foundAnimes.map(anime => ({
                        name: `${anime.NAME} ${chalk.gray(`(Sezon ${anime.SEASON_NUMBER}, ${anime.TOTAL_EPISODES} Bölüm)`)}`,
                        value: anime,
                    }))
                ],
            }]);

            if (anime === "back") continue;

            selectedAnime = anime;
            spinner.start();
        }

        /**
        * @typedef {{ episodes: import("../jsdoc.js").Episode[] }} Response
        * @type {import("axios").AxiosResponse<Response>}
        */
        let httpData;
        try {
            httpData = await axios.post(`${API_URL}/searchAnime`, { payload: selectedAnime.SLUG });
        } catch (error) {
            spinner.fail(chalk.red("Anime bölümleri alınamadı. Lütfen daha sonra tekrar deneyin."));
            console.error(chalk.gray(`Hata Detayı: ${error.message}`));
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
        }

        episodes = httpData.data.episodes;

        if (!episodes || episodes.length === 0) {
            spinner.fail(chalk.gray("Bu anime için henüz bölüm bulunamadı."));
            await new Promise(resolve => setTimeout(resolve, 1500));
            continue;
        }

        spinner.stop();
        break;
    }

    const config = getConfig();
    console.clear();

    if (config.showAnimeDetails !== false) {
        console.log(chalk.bold.hex("#38bdf8")(selectedAnime.NAME));
        console.log(chalk.gray("─".repeat(50)));

        console.log(`${chalk.bold("Bölüm Sayısı:")} ${selectedAnime.TOTAL_EPISODES}`);
        console.log(`${chalk.bold("Sezon:")} ${selectedAnime.SEASON_NUMBER}`);

        if (selectedAnime.CATEGORIES && selectedAnime.CATEGORIES.length > 0) {
            console.log(`${chalk.bold("Kategoriler:")} ${selectedAnime.CATEGORIES.join(", ")}`);
        }

        if (selectedAnime.DESCRIPTION) {
            console.log(chalk.gray("─".repeat(50)));
            console.log(chalk.italic(selectedAnime.DESCRIPTION));
        } else if (selectedAnime.SYNOPSIS) {
            console.log(chalk.gray("─".repeat(50)));
            console.log(chalk.italic(selectedAnime.SYNOPSIS));
        }

        console.log(chalk.gray("─".repeat(50)));
        console.log("");
    } else {
        console.log(chalk.green(`\n${selectedAnime.NAME} seçildi!`));
        console.log(chalk.gray(`Toplam ${episodes.length} bölüm mevcut.`));
    }

    while (true) {
        const { action } = await inquirer.prompt([{
            type: "list",
            name: "action",
            message: "Bir işlem seçin:",
            choices: [
                { name: "Bölümü İzle", value: "watch" },
                { name: "Bölümleri İndir", value: "download" },
                { name: "Geri Dön", value: "back" }
            ]
        }]);

        if (action === "back") return;

        let selectedEpisodes = [];

        if (action === "watch") {
            while (true) {
                console.clear();
                console.log(chalk.green(`\n${selectedAnime.NAME} - İzle`));

                const { episode } = await inquirer.prompt([{
                    type: "list",
                    name: "episode",
                    message: "İzlemek istediğiniz bölümü seçin:",
                    pageSize: 15,
                    loop: false,
                    choices: [
                        { name: "Geri Dön", value: "back" },
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
                    console.log(chalk.red("Seçilen bölüm için izleme kaynağı bulunamadı."));
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    continue;
                }

                try {
                    const config = getConfig();
                    const player = config.defaultPlayer || "vlc";

                    console.clear();
                    console.log(chalk.green(`${selectedAnime.NAME} — ${episode.episode_number}. Bölüm ${player} ile açılıyor...`));

                    setWatchingActivity({
                        animeName: selectedAnime.NAME,
                        animeImage: selectedAnime.FIRST_IMAGE,
                        episode: episode.episode_number,
                        totalEpisodes: episodes.length
                    });

                    if (player === "mpv") {
                        await openInMpv(episode.link);
                    } else {
                        await openInVlc(episode.link);
                    }

                    setActivity("Ana menüde geziniyor");

                    const { watched } = await inquirer.prompt([{
                        type: "confirm",
                        name: "watched",
                        message: "Bölümü 'İzlendi' olarak işaretlemek ister misiniz?",
                        default: true
                    }]);

                    if (watched) {
                        const totalEpisodes = episodes.length;
                        const epNum = typeof episode.episode_number === "number" ? episode.episode_number : parseInt(episode.episode_number);

                        let anilistId;
                        const history = loadHistory();
                        if (history[selectedAnime.NAME]) {
                            anilistId = history[selectedAnime.NAME].anilistId;
                        }

                        if (config.anilistToken && !anilistId) {
                            spinner.start("Anilist veritabanında aranıyor...");
                            anilistId = await searchAnime(selectedAnime.NAME);
                            spinner.stop();
                        }

                        updateHistory(selectedAnime.NAME, epNum, totalEpisodes, anilistId);
                        console.log(chalk.green("İzleme geçmişi güncellendi!"));

                        if (config.anilistToken && anilistId) {
                            spinner.start("Anilist güncelleniyor...");
                            const success = await updateAnilistProgress(anilistId, epNum, epNum >= totalEpisodes);
                            spinner.stop();
                            if (success) {
                                console.log(chalk.green("Anilist başarıyla güncellendi!"));
                            }
                        }

                        // Telemetry: Watch
                        await telemetry.send("watch", {
                            name: selectedAnime.NAME,
                            episode: epNum
                        });

                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                } catch (error) {
                    const config = getConfig();
                    console.error(chalk.red(`${config.defaultPlayer || "vlc"} başlatılamadı: ${error.message}`));
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        } else if (action === "download") {
            setActivity(`${selectedAnime.NAME}`, "Bölüm İndiriyor");
            console.clear();
            console.log(chalk.green(`\n${selectedAnime.NAME} - İndir`));

            const { selectionMethod } = await inquirer.prompt([{
                type: "list",
                name: "selectionMethod",
                message: "Bölümleri nasıl seçmek istersiniz?",
                choices: [
                    { name: "Listeden seç (Tek tek)", value: "list" },
                    { name: "Aralık gir (Örn: 1-12, 15)", value: "range" },
                    { name: "Tümünü indir", value: "all" },
                    { name: "Geri Dön", value: "back" }
                ]
            }]);

            if (selectionMethod === "back") continue;

            if (selectionMethod === "list") {
                console.clear();
                console.log(chalk.green(`\n${selectedAnime.NAME} - Bölüm Seçimi`));

                const { episodes: selected } = await inquirer.prompt([{
                    type: "checkbox",
                    name: "episodes",
                    message: "İndirmek istediğiniz bölümleri seçin (Boşluk ile seçip Enter ile onaylayın):",
                    choices: episodes.map(({ id, episode_number, type, fansub, backblaze_link, watch_link_1, watch_link_2, watch_link_3 }) => {
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
                    }),
                }]);
                selectedEpisodes = selected;
            } else if (selectionMethod === "range") {
                console.clear();
                console.log(chalk.green(`\n${selectedAnime.NAME} - Aralık Seçimi`));

                const { range } = await inquirer.prompt([{
                    type: "input",
                    name: "range",
                    message: "Bölüm aralığını giriniz (Örn: 1-12, 15, 20-25):",
                    validate: (input) => {
                        if (!input || input.trim() === "") return "Lütfen geçerli bir aralık giriniz.";
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
                console.log(chalk.yellow("Hiçbir bölüm seçilmedi."));
                continue;
            }

            console.clear();

            const { downloadAction } = await inquirer.prompt([{
                type: "list",
                name: "downloadAction",
                message: "Ne yapmak istersiniz?",
                choices: [
                    { name: "İndirme Kuyruğuna Ekle", value: "queue" },
                    { name: "Hemen İndir", value: "now" }
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
                console.log(chalk.green(`${selectedEpisodes.length} bölüm kuyruğa eklendi.`));
                await new Promise(resolve => setTimeout(resolve, 1000));
                return;
            }

            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }

            if (selectedEpisodes.length > 1) {
                console.log(chalk.cyan(`\n${selectedEpisodes.length} bölüm seçildi. Eşzamanlı en fazla ${config.maxConcurrent} indirme yapılacak.`));
            }

            const progressUI = new ProgressBar();
            selectedEpisodes.forEach(ep => {
                progressUI.update(ep.episode_number, { percent: 0, status: 'Bekliyor', name: `Bölüm ${ep.episode_number}` });
            });

            if (selectedEpisodes.length > 1) {
                console.log("\n".repeat(Math.min(selectedEpisodes.length, config.maxConcurrent)));
            }

            const tasks = selectedEpisodes.map((episode) => async () => {
                if (!episode.link) {
                    console.log(chalk.red(`${episode.episode_number}. bölüm için indirme linki bulunamadı.`));
                    return;
                }

                const safeAnimeName = selectedAnime.NAME.replace(/[<>:"/\\|?*]/g, "").trim();
                const downloadPath = path.join(dirPath, `${safeAnimeName} - ${episode.episode_number}`);
                const isSingle = selectedEpisodes.length === 1;

                async function downloadEpisode(attempt = 1) {
                    try {
                        if (!isSingle) {
                            progressUI.update(episode.episode_number, { percent: 0, status: attempt === 1 ? 'İndiriliyor' : 'Tekrar deneniyor' });
                        }

                        const finalPath = commandExists("aria2c") && config.useAria2 ? downloadPath : `${downloadPath}.mp4`; // Rough guess, actually 'dl' handles extensions differently.

                        await dl(episode.link, downloadPath, {
                            silent: !isSingle,
                            onProgress: (data) => {
                                if (!isSingle) {
                                    progressUI.update(episode.episode_number, {
                                        percent: data.percent,
                                        status: attempt === 1 ? 'İndiriliyor' : 'Tekrar deneniyor',
                                        speed: data.speed,
                                        eta: data.eta,
                                        downloaded: data.downloaded,
                                        total: data.total
                                    });
                                }
                            }
                        }, {
                            count: config.retryEnabled ? (config.retryCount || 3) : 0,
                            delay: config.retryDelay || 3000
                        });

                        const dirFiles = fs.readdirSync(dirPath);
                        const downloadedFile = dirFiles.find(f => f.startsWith(`${safeAnimeName} - ${episode.episode_number}.`));

                        if (downloadedFile) {
                            const stats = fs.statSync(path.join(dirPath, downloadedFile));
                            if (stats.size < 1024 * 1024) {
                                throw new Error("Dosya boyutu çok küçük, hatalı indirme olabilir.");
                            }
                        } else {
                        }

                        if (!isSingle) {
                            progressUI.update(episode.episode_number, { percent: 100, status: 'Tamamlandı' });
                        } else {
                            spinner.succeed(chalk.bold(`${selectedAnime.NAME} — ${episode.episode_number}. bölüm başarıyla indirildi.`));
                        }

                        await telemetry.send("download", {
                            name: selectedAnime.NAME,
                            episode: episode.episode_number
                        });

                    } catch (error) {
                        if (attempt === 1) {
                            if (!isSingle) {
                                progressUI.update(episode.episode_number, { percent: 0, status: 'Doğrulama hatası, tekrar' });
                            }
                            await new Promise(r => setTimeout(r, 2000));
                            await downloadEpisode(2);
                        } else {
                            if (!isSingle) {
                                progressUI.update(episode.episode_number, { percent: 0, status: 'Hata' });
                            } else {
                                spinner.fail(chalk.red("Hata oluştu."));
                                console.error(chalk.gray(`Detay: ${error.message}`));
                            }
                        }
                    }
                }

                await downloadEpisode(1);
            });
            await batch(tasks, config.maxConcurrent);
            progressUI.clear();

            if (selectedEpisodes.length > 1) {
                spinner.succeed(chalk.bold("İndirme işlemi tamamlandı."));
            }
            return;
        }
    }
}