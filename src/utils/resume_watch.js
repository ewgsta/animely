import inquirer from "inquirer";
import chalk from "chalk";
import axios from "axios";
import { getConfig } from "./storage/config.js";
import { formatName, getLink } from "../functions/episodes.js";
import { openInVlc } from "./players/vlc.js";
import { openInMpv } from "./players/mpv.js";
import { setActivity, setWatchingActivity } from "./discord.js";
import { updateHistory, loadHistory } from "./storage/history.js";
import { getWatchPosition, updateWatchPosition, clearWatchPosition } from "./storage/watch_progress.js";
import { searchAnime, updateAnilistProgress } from "./anilist.js";
import { spinner } from "./spinner.js";
import { API_URL } from "../constants.js";
import { t } from "../i18n/index.js";

/**
 * @param {import("../jsdoc.js").Anime} anime
 * @param {number} nextEpisodeNumber
 */
export async function resumeWatch(anime, nextEpisodeNumber) {
    console.clear();
    spinner.start(t("spinner.fetchingEpisodes", { name: anime.NAME }));

    let episodes;
    try {
        const response = await axios.post(`${API_URL}/searchAnime`, { payload: anime.SLUG });
        episodes = response.data.episodes;
    } catch (error) {
        spinner.fail(chalk.red(t("episodes.loadFailed")));
        await new Promise(resolve => setTimeout(resolve, 2000));
        return;
    }
    spinner.stop();

    const episode = episodes.find(e => e.episode_number == nextEpisodeNumber);

    if (!episode) {
        console.log(chalk.yellow(`\n${t("player.episodeNotFound", { episode: nextEpisodeNumber })}`));
        await new Promise(resolve => setTimeout(resolve, 2000));
        return;
    }

    const links = [episode.backblaze_link, episode.watch_link_1, episode.watch_link_2, episode.watch_link_3];
    const link = getLink(links);

    if (!link) {
        console.log(chalk.red("\n" + t("player.linkNotFound")));
        await new Promise(resolve => setTimeout(resolve, 2000));
        return;
    }

    const config = getConfig();
    const player = config.defaultPlayer || "vlc";

    // MPV için kaldığı yerden devam özelliği
    let startPosition = 0;
    if (player === "mpv") {
        const savedProgress = getWatchPosition(anime.NAME, nextEpisodeNumber);

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
                clearWatchPosition(anime.NAME, nextEpisodeNumber);
            }
        }
    }

    console.log(chalk.green(`\n${t("player.episodeOpening", { name: anime.NAME, episode: nextEpisodeNumber, player })}`));
    setWatchingActivity({
        animeName: anime.NAME,
        animeImage: anime.FIRST_IMAGE,
        episode: nextEpisodeNumber,
        totalEpisodes: episodes.length
    });

    try {
        if (player === "mpv") {
            const onPlayerClose = (position, duration) => {
                if (position > 10 && duration > 0) {
                    updateWatchPosition(anime.NAME, nextEpisodeNumber, position, duration);
                }
            };
            await openInMpv(link, { startPosition, onClose: onPlayerClose });
        } else {
            await openInVlc(link);
        }

        setActivity(t("menu.browsingMenu"));

        const { watched } = await inquirer.prompt([{
            type: "confirm",
            name: "watched",
            message: t("player.markWatched"),
            default: true
        }]);

        if (watched) {
            const totalEpisodes = episodes.length;

            let anilistId;
            const history = loadHistory();
            if (history[anime.NAME]) {
                anilistId = history[anime.NAME].anilistId;
            }

            if (config.anilistToken && !anilistId) {
                spinner.start(t("player.anilistSearching"));
                anilistId = await searchAnime(anime.NAME);
                spinner.stop();
            }

            updateHistory(anime.NAME, nextEpisodeNumber, totalEpisodes, anilistId);

            if (config.anilistToken && anilistId) {
                spinner.start(t("anilist.historyUpdating"));
                const success = await updateAnilistProgress(anilistId, nextEpisodeNumber, nextEpisodeNumber >= totalEpisodes);
                spinner.stop();
                if (success) {
                    console.log(chalk.green(""));
                }
            }
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    } catch (error) {
        console.error(chalk.red(t("player.playerError", { message: error.message })));
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}
