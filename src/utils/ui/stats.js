// @ts-check
import chalk from "chalk";
import inquirer from "inquirer";
import { loadHistory } from "../storage/history.js";
import { t } from "../../i18n/index.js";

export async function stats() {
    console.clear();
    const history = loadHistory();
    const animes = Object.values(history);

    if (animes.length === 0) {
        console.log(chalk.yellow(t("stats.emptyHistory")));
        await inquirer.prompt([{ type: 'input', name: 'devam', message: t("stats.pressEnter") }]);
        return;
    }

    const totalAnimes = animes.length;
    const completedAnimes = animes.filter(a => a.completed).length;
    const watchingAnimes = totalAnimes - completedAnimes;

    const totalEpisodes = animes.reduce((acc, curr) => acc + (curr.lastEpisode || 0), 0);

    const totalMinutes = totalEpisodes * 24;
    const hours = Math.floor(totalMinutes / 60);
    const days = (hours / 24).toFixed(1);

    const lastWatched = animes.sort((a, b) => new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime())[0];

    console.log(`${chalk.cyan(t("stats.totalAnime"))}    ${chalk.bold(totalAnimes)}`);
    console.log(`${chalk.cyan(t("stats.completedAnime"))}   ${chalk.green(completedAnimes)}`);
    console.log(`${chalk.cyan(t("stats.watchingAnime"))}   ${chalk.yellow(watchingAnimes)}`);
    console.log("");
    console.log(`${chalk.cyan(t("stats.totalEpisodes"))}    ${chalk.bold(totalEpisodes)}`);
    console.log(`${chalk.cyan(t("stats.watchTime"))}   ${chalk.bold(t("stats.hours", { hours }))} ${chalk.gray(`(${t("stats.days", { days })})`)}`);
    console.log("");

    if (lastWatched) {
        console.log(`${chalk.cyan(t("stats.lastWatched"))}     ${chalk.magenta(lastWatched.name)} ${chalk.gray(`(${timeAgo(new Date(lastWatched.lastWatchedAt))})`)}`);
    }

    await inquirer.prompt([{ type: 'input', name: 'devam', message: t("stats.pressEnter") }]);
}

/**
 * @param {Date} date
 */
function timeAgo(date) {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return t("stats.timeAgo.years", { count: Math.floor(interval) });

    interval = seconds / 2592000;
    if (interval > 1) return t("stats.timeAgo.months", { count: Math.floor(interval) });

    interval = seconds / 86400;
    if (interval > 1) return t("stats.timeAgo.days", { count: Math.floor(interval) });

    interval = seconds / 3600;
    if (interval > 1) return t("stats.timeAgo.hours", { count: Math.floor(interval) });

    interval = seconds / 60;
    if (interval > 1) return t("stats.timeAgo.minutes", { count: Math.floor(interval) });

    return t("stats.timeAgo.justNow");
}
