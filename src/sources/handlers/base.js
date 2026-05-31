// @ts-check
import inquirer from "inquirer";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { getConfig } from "../../utils/storage/config.js";
import { saveQueue } from "../../utils/storage/queue.js";
import { openInVlc } from "../../utils/players/vlc.js";
import { openInMpv } from "../../utils/players/mpv.js";
import { setActivity, setWatchingActivity } from "../../utils/discord.js";
import { updateHistory, loadHistory } from "../../utils/storage/history.js";
import { getWatchPosition, updateWatchPosition, clearWatchPosition } from "../../utils/storage/watch_progress.js";
import { searchAnime, updateAnilistProgress } from "../../utils/anilist.js";
import { spinner } from "../../utils/spinner.js";
import { dl } from "../../utils/download/download.js";
import { batch } from "../../utils/download/concurrency.js";
import { ProgressBar } from "../../utils/download/progress.js";
import { menuHeader } from "../../utils/ui/box.js";
import { t } from "../../i18n/index.js";

/**
 * Bölüm seçim metodunu sor
 * @param {string} animeName
 * @returns {Promise<"list"|"range"|"all"|"back">}
 */
export async function askSelectionMethod(animeName) {
    console.clear();
    console.log(chalk.bgGreen.black(` ${t("download.downloadTitle", { name: animeName })} `));
    console.log("");

    const { selectionMethod } = await inquirer.prompt([{
        type: "list",
        name: "selectionMethod",
        message: t("download.selectionMethod"),
        choices: [
            { name: t("download.selectFromList"), value: "list" },
            { name: t("download.enterRange"), value: "range" },
            { name: t("download.downloadAll"), value: "all" },
            { name: t("download.goBack"), value: "back" }
        ]
    }]);

    return selectionMethod;
}

/**
 * Aralık girişinden bölüm numaralarını parse et
 * @param {string} rangeInput
 * @returns {Set<number>}
 */
export function parseRange(rangeInput) {
    const parts = rangeInput.split(",").map(p => p.trim());
    const numbers = new Set();

    for (const part of parts) {
        if (part.includes("-")) {
            const [start, end] = part.split("-").map(n => parseInt(n.trim(), 10));
            if (!isNaN(start) && !isNaN(end)) {
                for (let i = start; i <= end; i++) numbers.add(i);
            }
        } else {
            const num = parseInt(part, 10);
            if (!isNaN(num)) numbers.add(num);
        }
    }

    return numbers;
}

/**
 * Kalite seçimi yap
 * @param {import("../index.js").StreamLink[]} streamLinks
 * @returns {Promise<string>}
 */
export async function selectQuality(streamLinks) {
    if (streamLinks.length <= 1) {
        return streamLinks[0]?.url || "";
    }

    const { quality } = await inquirer.prompt([{
        type: "list",
        name: "quality",
        message: t("player.selectQuality"),
        choices: streamLinks.map(s => ({
            name: s.quality || s.label || t("player.default"),
            value: s.url
        }))
    }]);

    return quality;
}

/**
 * İndirme veya kuyruğa ekleme seçimi
 * @returns {Promise<"queue"|"now">}
 */
export async function askDownloadAction() {
    const { downloadAction } = await inquirer.prompt([{
        type: "list",
        name: "downloadAction",
        message: t("download.whatToDo"),
        choices: [
            { name: t("download.addToQueue"), value: "queue" },
            { name: t("download.downloadNow"), value: "now" }
        ]
    }]);

    return downloadAction;
}

/**
 * Bölümleri indir
 * @param {object} params
 * @param {string} params.animeName
 * @param {Array<{episode_number: number, link?: string, url?: string}>} params.episodes
 * @param {string} params.dirPath
 * @param {(episode: any) => Promise<string|null>} [params.getDownloadUrl] - Dinamik URL alma fonksiyonu
 */
export async function downloadEpisodes({ animeName, episodes, dirPath, getDownloadUrl }) {
    const config = getConfig();
    const safeAnimeName = animeName.replace(/[<>:"/\\|?*]/g, "").trim();

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    if (episodes.length > 1) {
        console.log(chalk.cyan(`\n${t("download.episodesSelected", { count: episodes.length, limit: config.maxConcurrent })}`));
    }

    const progressUI = new ProgressBar();
    episodes.forEach(ep => {
        progressUI.update(ep.episode_number, { 
            percent: 0, 
            status: t("progress.waiting"), 
            name: `${t("episodes.episode")} ${ep.episode_number}` 
        });
    });

    if (episodes.length > 1) {
        console.log("\n".repeat(Math.min(episodes.length, config.maxConcurrent)));
    }

    const tasks = episodes.map((episode) => async () => {
        const downloadPath = path.join(dirPath, `${safeAnimeName} - ${episode.episode_number}`);
        const isSingle = episodes.length === 1;

        async function downloadEpisode(attempt = 1) {
            try {
                let downloadUrl = episode.link || episode.url;

                // Dinamik URL alma (Animecix için)
                if (!downloadUrl && getDownloadUrl) {
                    if (!isSingle) {
                        progressUI.update(episode.episode_number, { 
                            percent: 0, 
                            status: attempt === 1 ? t("progress.gettingLink") : t("progress.retrying") 
                        });
                    } else {
                        spinner.start(t("download.gettingLink", { episode: episode.episode_number }));
                    }

                    downloadUrl = await getDownloadUrl(episode);
                    if (isSingle) spinner.stop();
                }

                if (!downloadUrl) {
                    throw new Error(t("download.linkNotFound"));
                }

                if (!isSingle) {
                    progressUI.update(episode.episode_number, { 
                        percent: 0, 
                        status: attempt === 1 ? t("progress.downloading") : t("progress.retrying") 
                    });
                }

                await dl(downloadUrl, downloadPath, {
                    silent: !isSingle,
                    onProgress: (data) => {
                        if (!isSingle) {
                            progressUI.update(episode.episode_number, {
                                percent: data.percent,
                                status: attempt === 1 ? t("progress.downloading") : t("progress.retrying"),
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
                    progressUI.update(episode.episode_number, { percent: 100, status: t("progress.completed") });
                } else {
                    spinner.succeed(chalk.bold(t("download.episodeDownloaded", { name: animeName, episode: episode.episode_number })));
                }

            } catch (error) {
                if (attempt === 1) {
                    if (!isSingle) {
                        progressUI.update(episode.episode_number, { percent: 0, status: t("progress.errorRetrying") });
                    }
                    await new Promise(r => setTimeout(r, 2000));
                    await downloadEpisode(2);
                } else {
                    if (!isSingle) {
                        progressUI.update(episode.episode_number, { percent: 0, status: t("progress.error") });
                    } else {
                        spinner.fail(chalk.red(t("progress.error")));
                        console.error(chalk.gray(t("app.errorDetail", { message: error.message })));
                    }
                }
            }
        }

        await downloadEpisode(1);
    });

    await batch(tasks, config.maxConcurrent);
    progressUI.clear();

    if (episodes.length > 1) {
        spinner.succeed(chalk.bold(t("download.downloadComplete")));
    }

    await new Promise(r => setTimeout(r, 1500));
}

/**
 * Bölümü oynat
 * @param {object} params
 * @param {string} params.animeName
 * @param {string} params.animeImage
 * @param {number} params.episodeNumber
 * @param {number} params.totalEpisodes
 * @param {string} params.streamUrl
 * @param {boolean} [params.supportResume=true]
 */
export async function playEpisode({ animeName, animeImage, episodeNumber, totalEpisodes, streamUrl, supportResume = true }) {
    const config = getConfig();
    const player = config.defaultPlayer || "vlc";

    console.clear();

    let startPosition = 0;
    if (player === "mpv" && supportResume) {
        const savedProgress = getWatchPosition(animeName, episodeNumber);

        if (savedProgress && savedProgress.position > 10) {
            const minutes = Math.floor(savedProgress.position / 60);
            const seconds = savedProgress.position % 60;
            const { resumeFromSaved } = await inquirer.prompt([{
                type: "confirm",
                name: "resumeFromSaved",
                message: t("player.resumePrompt", { time: `${minutes}:${seconds.toString().padStart(2, '0')}` }),
                default: true
            }]);

            if (resumeFromSaved) {
                startPosition = savedProgress.position;
            } else {
                clearWatchPosition(animeName, episodeNumber);
            }
        }
    }

    console.log(chalk.green(t("player.opening", { name: animeName, episode: episodeNumber, player })));

    setWatchingActivity({
        animeName,
        animeImage: animeImage || "",
        episode: episodeNumber,
        totalEpisodes
    });

    if (player === "mpv") {
        const onPlayerClose = (position, duration) => {
            if (position > 10 && duration > 0) {
                updateWatchPosition(animeName, episodeNumber, position, duration);
            }
        };
        await openInMpv(streamUrl, { startPosition, onClose: onPlayerClose });
    } else {
        await openInVlc(streamUrl);
    }

    setActivity(t("menu.browsingMenu"));
}

/**
 * İzleme sonrası işlemler (geçmiş güncelleme, anilist)
 * @param {object} params
 * @param {string} params.animeName
 * @param {number} params.episodeNumber
 * @param {number} params.totalEpisodes
 * @param {number} [params.existingAnilistId]
 */
export async function postWatchActions({ animeName, episodeNumber, totalEpisodes, existingAnilistId }) {
    const { watched } = await inquirer.prompt([{
        type: "confirm",
        name: "watched",
        message: t("player.markWatched"),
        default: true
    }]);

    if (!watched) return;

    const config = getConfig();
    let anilistId = existingAnilistId;

    if (config.anilistToken && !anilistId) {
        spinner.start(t("player.anilistSearching"));
        anilistId = await searchAnime(animeName);
        spinner.stop();
    }

    updateHistory(animeName, episodeNumber, totalEpisodes, anilistId);
    console.log(chalk.green(t("player.historyUpdated")));

    if (config.anilistToken && anilistId) {
        spinner.start(t("player.anilistUpdating"));
        const success = await updateAnilistProgress(anilistId, episodeNumber, episodeNumber >= totalEpisodes);
        spinner.stop();
        if (success) {
            console.log(chalk.green(t("player.anilistUpdated")));
        }
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
}

/**
 * Kuyruğa ekle
 * @param {object} params
 * @param {string} params.animeName
 * @param {Array<any>} params.episodes
 * @param {string} params.dirPath
 * @param {Array<any>} params.downloadQueue
 */
export function addToQueue({ animeName, episodes, dirPath, downloadQueue }) {
    const safeAnimeName = animeName.replace(/[<>:"/\\|?*]/g, "").trim();

    episodes.forEach(ep => {
        downloadQueue.push({
            animeName,
            episode: ep,
            dirPath,
            safeAnimeName
        });
    });

    saveQueue(downloadQueue);
    console.log(chalk.green(t("download.addedToQueue", { count: episodes.length })));
}

/**
 * Bölüm listesi seçim UI'ı oluştur
 * @param {Array<any>} episodes
 * @param {number} lastWatchedEp
 * @param {(ep: any) => {name: string, value: any, disabled?: boolean}} mapFn
 */
export function buildEpisodeChoices(episodes, lastWatchedEp, mapFn) {
    return [
        { name: t("episodes.goBack"), value: "back" },
        new inquirer.Separator(),
        ...episodes.map((ep, idx) => {
            const epNum = typeof ep.episode_number === "number" ? ep.episode_number : parseInt(ep.episode_number, 10);
            const isLastWatched = epNum === lastWatchedEp;
            const isNext = epNum === lastWatchedEp + 1;

            let prefix = "  ";
            if (isLastWatched) prefix = chalk.yellow("▶ ");
            else if (isNext) prefix = chalk.green("● ");

            const mapped = mapFn(ep);
            const suffix = isLastWatched 
                ? chalk.gray(` (${t("episodes.lastWatched")})`) 
                : (isNext ? chalk.gray(` (${t("episodes.nextUp")})`) : "");

            return {
                ...mapped,
                name: `${prefix}${mapped.name}${suffix}`
            };
        })
    ];
}
