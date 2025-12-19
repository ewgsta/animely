import inquirer from "inquirer";
import chalk from "chalk";
import axios from "axios";
import { getConfig } from "./config.js";
import { formatName, getLink } from "../functions/episodes.js";
import { openInVlc } from "./vlc.js";
import { openInMpv } from "./mpv.js";
import { setActivity } from "./discord.js";
import { updateHistory, loadHistory } from "./history.js";
import { searchAnime, updateAnilistProgress } from "./anilist.js";
import { spinner } from "./spinner.js";
import { API_URL } from "../constants.js";

/**
 * @param {import("../jsdoc.js").Anime} anime
 * @param {number} nextEpisodeNumber
 */
export async function resumeWatch(anime, nextEpisodeNumber) {
    console.clear();
    spinner.start(`${anime.NAME} bolumleri geliyo...`);

    let episodes;
    try {
        const response = await axios.post(`${API_URL}/searchAnime`, { payload: anime.SLUG });
        episodes = response.data.episodes;
    } catch (error) {
        spinner.fail(chalk.red("bolumleri cekemedim"));
        await new Promise(resolve => setTimeout(resolve, 2000));
        return;
    }
    spinner.stop();

    const episode = episodes.find(e => e.episode_number == nextEpisodeNumber);

    if (!episode) {
        console.log(chalk.yellow(`\n${nextEpisodeNumber}. bolum yok (daha cikmamis olabilir)`));
        await new Promise(resolve => setTimeout(resolve, 2000));
        return;
    }

    const links = [episode.backblaze_link, episode.watch_link_1, episode.watch_link_2, episode.watch_link_3];
    const link = getLink(links);

    if (!link) {
        console.log(chalk.red("\nlink yok"));
        await new Promise(resolve => setTimeout(resolve, 2000));
        return;
    }

    const config = getConfig();
    const player = config.defaultPlayer || "vlc";

    console.log(chalk.green(`\n${anime.NAME} — ${nextEpisodeNumber}. bolum aciliyor (${player})...`));
    setActivity(`${anime.NAME}`, `${nextEpisodeNumber}. bolum izleniyor`);

    try {
        if (player === "mpv") {
            await openInMpv(link);
        } else {
            await openInVlc(link);
        }

        setActivity("ana menude takiliyor");

        const { watched } = await inquirer.prompt([{
            type: "confirm",
            name: "watched",
            message: "izledin mi, isaretleyim mi?",
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
                spinner.start("anilistte ariyorum...");
                anilistId = await searchAnime(anime.NAME);
                spinner.stop();
            }

            updateHistory(anime.NAME, nextEpisodeNumber, totalEpisodes, anilistId);
            console.log(chalk.green("gecmise islendi"));

            if (config.anilistToken && anilistId) {
                spinner.start("anilist guncelleniyor...");
                const success = await updateAnilistProgress(anilistId, nextEpisodeNumber, nextEpisodeNumber >= totalEpisodes);
                spinner.stop();
                if (success) {
                    console.log(chalk.green("anilist tamam"));
                }
            }
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    } catch (error) {
        console.error(chalk.red(`oynatici hatasi: ${error.message}`));
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}
