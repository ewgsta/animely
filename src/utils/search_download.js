import inquirer from "inquirer";
import chalk from "chalk";
import axios from "axios";
import fs from "fs";
import path from "path";
import { getConfig } from "./config.js";
import { saveQueue } from "./queue.js";
import { searchAnimes } from "./search.js";
import { formatName, getLink } from "../functions/episodes.js";
import { openInVlc } from "./vlc.js";
import { openInMpv } from "./mpv.js";
import { setActivity } from "./discord.js";
import { updateHistory, loadHistory } from "./history.js";
import { searchAnime, updateAnilistProgress } from "./anilist.js";
import { spinner } from "./spinner.js";
import { dl } from "./download.js";
import { batch } from "./concurrency.js";
import { ProgressBar } from "./progress.js";
import { API_URL } from "../constants.js";
import { telemetry } from "../telemetry/index.js";

/**
 * @param {import("../jsdoc.js").Anime[]} animes 
 * @param {import("../utils/queue.js").QueueItem[]} downloadQueue
 */
export async function searchAndDownload(animes, downloadQueue) {
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
        * @typedef {{ episodes: import("../jsdoc.js").Episode[] }} Response
        * @type {import("axios").AxiosResponse<Response>}
        */
        let httpData;
        try {
            httpData = await axios.post(`${API_URL}/searchAnime`, { payload: selectedAnime.SLUG });
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

                        let anilistId;
                        const history = loadHistory();
                        if (history[selectedAnime.NAME]) {
                            anilistId = history[selectedAnime.NAME].anilistId;
                        }

                        if (config.anilistToken && !anilistId) {
                            spinner.start("anilist'te anime araniyor...");
                            anilistId = await searchAnime(selectedAnime.NAME);
                            spinner.stop();
                        }

                        updateHistory(selectedAnime.NAME, epNum, totalEpisodes, anilistId);
                        console.log(chalk.green("gecmis guncellendi!"));

                        if (config.anilistToken && anilistId) {
                            spinner.start("anilist guncelleniyor...");
                            const success = await updateAnilistProgress(anilistId, epNum, epNum >= totalEpisodes);
                            spinner.stop();
                            if (success) {
                                console.log(chalk.green("anilist basariyla guncellendi!"));
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

            const progressUI = new ProgressBar();
            selectedEpisodes.forEach(ep => {
                progressUI.update(ep.episode_number, { percent: 0, status: 'bekliyor', name: `Bolum ${ep.episode_number}` });
            });

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
                        progressUI.update(episode.episode_number, { percent: 0, status: 'indiriliyor' });
                    }

                    await dl(episode.link, downloadPath, {
                        silent: !isSingle,
                        onProgress: (data) => {
                            if (!isSingle) {
                                progressUI.update(episode.episode_number, {
                                    percent: data.percent,
                                    status: 'indiriliyor',
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

                    if (!isSingle) {
                        progressUI.update(episode.episode_number, { percent: 100, status: 'tamamlandi' });
                    } else {
                        spinner.succeed(chalk.bold(`${selectedAnime.NAME} — ${episode.episode_number}. bolum indi.`));
                    }

                    // Telemetry: Download
                    await telemetry.send("download", {
                        name: selectedAnime.NAME,
                        episode: episode.episode_number
                    });
                } catch (error) {
                    if (!isSingle) {
                        progressUI.update(episode.episode_number, { percent: 0, status: 'hata' });
                    } else {
                        spinner.fail(chalk.red("hata olustu."));
                        console.error(chalk.gray(`detay: ${error.message}`));
                    }
                }
            });

            await batch(tasks, config.maxConcurrent);
            progressUI.clear();

            if (selectedEpisodes.length > 1) {
                spinner.succeed(chalk.bold("indirmeler bitti"));
            }
            return;
        }
    }
}