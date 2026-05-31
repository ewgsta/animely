// @ts-check
import inquirer from "inquirer";
import chalk from "chalk";
import axios from "axios";
import path from "path";
import { getConfig } from "../../utils/storage/config.js";
import { loadHistory } from "../../utils/storage/history.js";
import { setActivity } from "../../utils/discord.js";
import { spinner } from "../../utils/spinner.js";
import { menuHeader } from "../../utils/ui/box.js";
import { searchAnimes } from "../../utils/search.js";
import { formatName, getLink } from "../../functions/episodes.js";
import { API_URL } from "../../constants.js";
import { t } from "../../i18n/index.js";
import {
    askSelectionMethod,
    parseRange,
    askDownloadAction,
    downloadEpisodes,
    playEpisode,
    postWatchActions,
    addToQueue,
    buildEpisodeChoices
} from "./base.js";

/**
 * Animely kaynağı için arama ve indirme
 * @param {import("../../jsdoc.js").Anime[]} animes
 * @param {Array<any>} downloadQueue
 */
export async function handleAnimely(animes, downloadQueue) {
    let selectedAnime;
    let episodes;

    // Anime arama döngüsü
    while (true) {
        console.clear();
        const { name } = await inquirer.prompt([{
            type: "input",
            name: "name",
            message: t("search.enterName"),
            validate: (input) => {
                if (!input || input.trim() === "") {
                    return t("search.invalidName");
                }
                return true;
            },
        }]);

        if (name.toLowerCase() === t("search.cancel") || name.toLowerCase() === "iptal" || name.toLowerCase() === "cancel") {
            return;
        }

        spinner.start();

        const foundAnimes = searchAnimes(name, animes);

        if (foundAnimes.length === 0) {
            spinner.fail(chalk.gray(t("search.notFound")));
            await new Promise(resolve => setTimeout(resolve, 1500));
            continue;
        }

        if (foundAnimes.length === 1) {
            selectedAnime = foundAnimes[0];
        } else {
            spinner.stop();

            console.log(chalk.yellow(`\n${t("search.foundCount", { count: foundAnimes.length })}`));

            const { anime } = await inquirer.prompt([{
                type: "list",
                name: "anime",
                message: t("search.selectAnime"),
                pageSize: 15,
                loop: false,
                choices: [
                    { name: t("search.goBack"), value: "back" },
                    new inquirer.Separator(),
                    ...foundAnimes.map(anime => ({
                        name: `${anime.NAME} ${chalk.gray(`(${t("search.season")} ${anime.SEASON_NUMBER}, ${anime.TOTAL_EPISODES} ${t("search.episodes")})`)}`,
                        value: anime,
                    }))
                ],
            }]);

            if (anime === "back") continue;

            selectedAnime = anime;
            spinner.start();
        }

        // Bölümleri getir
        let httpData;
        try {
            httpData = await axios.post(`${API_URL}/searchAnime`, { payload: selectedAnime.SLUG });
        } catch (error) {
            spinner.fail(chalk.red(t("errors.episodesFailed")));
            console.error(chalk.gray(t("app.errorDetail", { message: error.message })));
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
        }

        episodes = httpData.data.episodes;

        if (!episodes || episodes.length === 0) {
            spinner.fail(chalk.gray(t("episodes.noEpisodes")));
            await new Promise(resolve => setTimeout(resolve, 1500));
            continue;
        }

        spinner.stop();
        break;
    }

    // Anime detayları
    const config = getConfig();
    console.clear();

    if (config.showAnimeDetails !== false) {
        console.log(chalk.bgCyan.black(` ${selectedAnime.NAME} \n\n`));
        console.log(`  ${chalk.gray(t("episodes.episode") + ":")} ${selectedAnime.TOTAL_EPISODES} ${chalk.gray("| " + t("search.season") + ":")} ${selectedAnime.SEASON_NUMBER}`);
        
        if (selectedAnime.CATEGORIES && selectedAnime.CATEGORIES.length > 0) {
            console.log(`  ${chalk.gray("Kategoriler:")} ${selectedAnime.CATEGORIES.join(", ")}`);
        }

        if (selectedAnime.DESCRIPTION || selectedAnime.SYNOPSIS) {
            const desc = selectedAnime.DESCRIPTION || selectedAnime.SYNOPSIS;
            console.log(chalk.italic.gray(`  ${desc.substring(0, 150)}${desc.length > 150 ? "..." : ""}`));
        }

        console.log("");
    } else {
        console.log(chalk.bgCyan.black(` ${selectedAnime.NAME} `) + chalk.gray(` ${t("episodes.episodeCount", { count: episodes.length })}`));
        console.log("");
    }

    // Ana menü
    while (true) {
        const { action } = await inquirer.prompt([{
            type: "list",
            name: "action",
            message: t("episodes.selectAction"),
            choices: [
                { name: t("episodes.watch"), value: "watch" },
                { name: t("episodes.download"), value: "download" },
                { name: t("episodes.goBack"), value: "back" }
            ]
        }]);

        if (action === "back") return;

        if (action === "watch") {
            await watchEpisode(selectedAnime, episodes);
        } else if (action === "download") {
            await downloadEpisodesFlow(selectedAnime, episodes, downloadQueue);
        }
    }
}

/**
 * Bölüm izleme
 */
async function watchEpisode(selectedAnime, episodes) {
    const history = loadHistory();
    const animeHistory = history[selectedAnime.NAME];
    const lastWatchedEp = animeHistory?.lastEpisode || 0;

    while (true) {
        console.clear();
        menuHeader(selectedAnime.NAME, lastWatchedEp, episodes.length);

        const choices = buildEpisodeChoices(episodes, lastWatchedEp, (ep) => {
            const links = [ep.backblaze_link, ep.watch_link_1, ep.watch_link_2, ep.watch_link_3];
            const hasValidLink = !links.every((link) => !link || link.trim() === "");

            return {
                name: formatName(ep.episode_number, ep.type),
                value: {
                    id: ep.id,
                    episode_number: ep.episode_number,
                    link: getLink(links),
                },
                disabled: !hasValidLink
            };
        });

        const { episode } = await inquirer.prompt([{
            type: "list",
            name: "episode",
            message: t("episodes.selectEpisode"),
            pageSize: 15,
            loop: false,
            choices
        }]);

        if (episode === "back") break;

        if (!episode.link) {
            console.log(chalk.red(t("player.sourceNotFound")));
            await new Promise(resolve => setTimeout(resolve, 1500));
            continue;
        }

        try {
            await playEpisode({
                animeName: selectedAnime.NAME,
                animeImage: selectedAnime.FIRST_IMAGE,
                episodeNumber: typeof episode.episode_number === "number" 
                    ? episode.episode_number 
                    : parseInt(episode.episode_number, 10),
                totalEpisodes: episodes.length,
                streamUrl: episode.link,
                supportResume: true
            });

            await postWatchActions({
                animeName: selectedAnime.NAME,
                episodeNumber: typeof episode.episode_number === "number" 
                    ? episode.episode_number 
                    : parseInt(episode.episode_number, 10),
                totalEpisodes: episodes.length,
                existingAnilistId: animeHistory?.anilistId
            });

        } catch (error) {
            console.error(chalk.red(t("player.playerError", { message: error.message })));
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

/**
 * Bölüm indirme akışı
 */
async function downloadEpisodesFlow(selectedAnime, episodes, downloadQueue) {
    setActivity(`${selectedAnime.NAME}`, t("progress.downloading"));

    const selectionMethod = await askSelectionMethod(selectedAnime.NAME);
    if (selectionMethod === "back") return;

    let selectedEpisodes = [];

    if (selectionMethod === "list") {
        console.clear();
        console.log(chalk.bgCyan.black(` ${t("download.episodeSelection", { name: selectedAnime.NAME })} `));
        console.log("");

        const { selected } = await inquirer.prompt([{
            type: "checkbox",
            name: "selected",
            message: t("download.selectEpisodes"),
            choices: episodes.map(ep => {
                const links = [ep.backblaze_link, ep.watch_link_1, ep.watch_link_2, ep.watch_link_3];
                const hasValidLink = !links.every((link) => !link || link.trim() === "");

                return {
                    name: formatName(ep.episode_number, ep.type),
                    value: {
                        id: ep.id,
                        episode_number: ep.episode_number,
                        link: getLink(links),
                    },
                    disabled: !hasValidLink
                };
            })
        }]);
        selectedEpisodes = selected;

    } else if (selectionMethod === "range") {
        console.clear();
        console.log(chalk.bgCyan.black(` ${t("download.rangeSelection", { name: selectedAnime.NAME })} `));
        console.log("");

        const { range } = await inquirer.prompt([{
            type: "input",
            name: "range",
            message: t("download.enterRangePrompt"),
            validate: (input) => {
                if (!input || input.trim() === "") return t("download.invalidRange");
                return true;
            }
        }]);

        const numbers = parseRange(range);
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
        console.log(chalk.yellow(t("download.noEpisodeSelected")));
        return;
    }

    console.clear();

    const downloadAction = await askDownloadAction();
    const config = getConfig();
    const safeAnimeName = selectedAnime.NAME.replace(/[<>:"/\\|?*]/g, "").trim();
    const dirPath = path.join(config.downloadDir, safeAnimeName);

    if (downloadAction === "queue") {
        addToQueue({
            animeName: selectedAnime.NAME,
            episodes: selectedEpisodes,
            dirPath,
            downloadQueue
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        return;
    }

    await downloadEpisodes({
        animeName: selectedAnime.NAME,
        episodes: selectedEpisodes,
        dirPath
    });
}
