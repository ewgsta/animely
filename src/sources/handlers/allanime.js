import inquirer from "inquirer";
import chalk from "chalk";
import path from "path";
import { getConfig } from "../../utils/storage/config.js";
import { loadHistory } from "../../utils/storage/history.js";
import { setActivity } from "../../utils/discord.js";
import { spinner } from "../../utils/spinner.js";
import { menuHeader } from "../../utils/ui/box.js";
import { t } from "../../i18n/index.js";
import {
    askSelectionMethod,
    parseRange,
    selectQuality,
    askDownloadAction,
    downloadEpisodes,
    playEpisode,
    postWatchActions,
    addToQueue,
    buildEpisodeChoices
} from "./base.js";

export async function handleAllAnime(downloadQueue, source) {
    let selectedAnime;
    let episodes;

    const { audioType } = await inquirer.prompt([{
        type: "list",
        name: "audioType",
        message: t("allanime.selectAudioType"),
        choices: [
            { name: t("allanime.subbed"), value: "sub" },
            { name: t("allanime.dubbed"), value: "dub" }
        ],
        default: "sub"
    }]);

    source.setMode(audioType);

    while (true) {
        console.clear();
        const { name } = await inquirer.prompt([{
            type: "input",
            name: "name",
            message: t("search.enterName"),
            validate: (input) => input?.trim() ? true : t("search.invalidName")
        }]);

        if (name.toLowerCase() === t("search.cancel") || name.toLowerCase() === "cancel") {
            return;
        }

        spinner.start(t("search.searching"));

        let foundAnimes;
        try {
            foundAnimes = await source.search(name);
        } catch (error) {
            spinner.fail(chalk.red(t("search.searchFailed")));
            await new Promise(r => setTimeout(r, 1500));
            continue;
        }

        if (foundAnimes.length === 0) {
            spinner.fail(chalk.gray(t("search.noResults")));
            await new Promise(r => setTimeout(r, 1500));
            continue;
        }

        spinner.stop();

        const { anime } = await inquirer.prompt([{
            type: "list",
            name: "anime",
            message: t("search.selectAnime"),
            pageSize: 15,
            loop: false,
            choices: [
                { name: t("search.goBack"), value: "back" },
                new inquirer.Separator(),
                ...foundAnimes.map(a => ({
                    name: `${a.name} ${chalk.gray(`(${a.totalEpisodes} ${t("search.episodes")})`)}`,
                    value: a
                }))
            ]
        }]);

        if (anime === "back") continue;
        selectedAnime = anime;

        spinner.start(t("episodes.loading"));

        try {
            episodes = await source.getEpisodes(selectedAnime.id);
        } catch (error) {
            spinner.fail(chalk.red(t("episodes.loadFailed")));
            await new Promise(r => setTimeout(r, 1500));
            continue;
        }

        if (!episodes || episodes.length === 0) {
            spinner.fail(chalk.gray(t("episodes.notFound")));
            await new Promise(r => setTimeout(r, 1500));
            continue;
        }

        spinner.stop();
        break;
    }

    console.clear();
    const audioLabel = audioType === "sub" ? t("allanime.subbed") : t("allanime.dubbed");
    console.log(chalk.bgCyan.black(` ${selectedAnime.name} `) + chalk.gray(` ${t("episodes.episodeCount", { count: episodes.length })} | ${audioLabel}`));
    console.log("");

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
            await watchEpisode(selectedAnime, episodes, source);
        } else if (action === "download") {
            await downloadEpisodesFlow(selectedAnime, episodes, source, downloadQueue);
        }
    }
}

async function watchEpisode(selectedAnime, episodes, source) {
    const history = loadHistory();
    const animeHistory = history[selectedAnime.name];
    const lastWatchedEp = animeHistory?.lastEpisode || 0;

    while (true) {
        console.clear();
        menuHeader(selectedAnime.name, lastWatchedEp, episodes.length);

        const choices = buildEpisodeChoices(episodes, lastWatchedEp, (ep) => ({
            name: ep.name || t("episodes.episodeNumber", { number: ep.episode_number }),
            value: ep
        }));

        const { episode } = await inquirer.prompt([{
            type: "list",
            name: "episode",
            message: t("episodes.selectEpisode"),
            pageSize: 15,
            loop: false,
            choices
        }]);

        if (episode === "back") break;

        spinner.start(t("player.gettingLink"));

        let streamLinks;
        try {
            streamLinks = await source.getStreamLinks(episode);
        } catch (error) {
            spinner.fail(chalk.red(t("player.linkFailed")));
            await new Promise(r => setTimeout(r, 1500));
            continue;
        }

        if (!streamLinks || streamLinks.length === 0) {
            spinner.fail(chalk.red(t("player.sourceNotFound")));
            await new Promise(r => setTimeout(r, 1500));
            continue;
        }

        spinner.stop();

        const selectedLink = await selectQuality(streamLinks);

        try {
            await playEpisode({
                animeName: selectedAnime.name,
                animeImage: selectedAnime.poster || "",
                episodeNumber: episode.episode_number,
                totalEpisodes: episodes.length,
                streamUrl: selectedLink,
                supportResume: true
            });

            await postWatchActions({
                animeName: selectedAnime.name,
                episodeNumber: episode.episode_number,
                totalEpisodes: episodes.length,
                existingAnilistId: animeHistory?.anilistId
            });

        } catch (error) {
            console.error(chalk.red(t("player.playerError", { message: error.message })));
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

async function downloadEpisodesFlow(selectedAnime, episodes, source, downloadQueue) {
    setActivity(`${selectedAnime.name}`, t("progress.downloading"));

    const selectionMethod = await askSelectionMethod(selectedAnime.name);
    if (selectionMethod === "back") return;

    let selectedEpisodes = [];

    if (selectionMethod === "list") {
        console.clear();
        console.log(chalk.bgCyan.black(` ${t("download.episodeSelection", { name: selectedAnime.name })} `));
        console.log("");

        const { selected } = await inquirer.prompt([{
            type: "checkbox",
            name: "selected",
            message: t("download.selectEpisodes"),
            choices: episodes.map(ep => ({
                name: ep.name || t("episodes.episodeNumber", { number: ep.episode_number }),
                value: ep
            }))
        }]);
        selectedEpisodes = selected;

    } else if (selectionMethod === "range") {
        console.clear();
        console.log(chalk.bgCyan.black(` ${t("download.rangeSelection", { name: selectedAnime.name })} `));
        console.log("");

        const { range } = await inquirer.prompt([{
            type: "input",
            name: "range",
            message: t("download.enterRangePrompt"),
            validate: (input) => input?.trim() ? true : t("download.invalidRange")
        }]);

        const numbers = parseRange(range);
        selectedEpisodes = episodes.filter(ep => numbers.has(ep.episode_number));

    } else if (selectionMethod === "all") {
        selectedEpisodes = [...episodes];
    }

    if (!selectedEpisodes || selectedEpisodes.length === 0) {
        console.log(chalk.yellow(t("download.noEpisodeSelected")));
        await new Promise(r => setTimeout(r, 1000));
        return;
    }

    spinner.start(t("download.gettingQualities"));
    let availableQualities = [];
    try {
        const sampleLinks = await source.getStreamLinks(selectedEpisodes[0]);
        availableQualities = sampleLinks || [];
    } catch (e) {}
    spinner.stop();

    let selectedQuality = null;
    if (availableQualities.length > 1) {
        const { quality } = await inquirer.prompt([{
            type: "list",
            name: "quality",
            message: t("download.selectQuality"),
            choices: availableQualities.map(q => ({
                name: q.label || q.quality || t("player.default"),
                value: q.quality || q.label
            }))
        }]);
        selectedQuality = quality;
    }

    console.clear();

    const downloadAction = await askDownloadAction();
    const config = getConfig();
    const safeAnimeName = selectedAnime.name.replace(/[<>:"/\\|?*]/g, "").trim();
    const dirPath = path.join(config.downloadDir, safeAnimeName);

    const getDownloadUrl = async (episode) => {
        const streamLinks = await source.getStreamLinks(episode);
        if (!streamLinks || streamLinks.length === 0) return null;

        if (selectedQuality) {
            const matched = streamLinks.find(s => (s.quality || s.label) === selectedQuality);
            if (matched) return matched.url;
        }

        const sorted = [...streamLinks].sort((a, b) => {
            const getRes = (s) => parseInt((s.quality || s.label || "0").replace(/\D/g, "")) || 0;
            return getRes(b) - getRes(a);
        });
        return sorted[0].url;
    };

    if (downloadAction === "queue") {
        addToQueue({
            animeName: selectedAnime.name,
            episodes: selectedEpisodes,
            dirPath,
            downloadQueue
        });
        await new Promise(r => setTimeout(r, 1000));
        return;
    }

    await downloadEpisodes({
        animeName: selectedAnime.name,
        episodes: selectedEpisodes,
        dirPath,
        getDownloadUrl
    });
}
