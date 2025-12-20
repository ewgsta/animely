// @ts-check
import chalk from "chalk";
import inquirer from "inquirer";
import { loadHistory } from "./history.js";

export async function stats() {
    console.clear();
    const history = loadHistory();
    const animes = Object.values(history);

    if (animes.length === 0) {
        console.log(chalk.yellow("henuz hicbir sey izlememissin, buralar cok sessiz..."));
        await inquirer.prompt([{ type: 'input', name: 'devam', message: 'geri don' }]);
        return;
    }

    // Hesaplamalar (sayısalım kötü amk)
    const totalAnimes = animes.length;
    const completedAnimes = animes.filter(a => a.completed).length;
    const watchingAnimes = totalAnimes - completedAnimes;

    // Toplam bolum sayisi
    const totalEpisodes = animes.reduce((acc, curr) => acc + (curr.lastEpisode || 0), 0);

    // Sure (bolum basi 24dk diyelim)
    const totalMinutes = totalEpisodes * 24;
    const hours = Math.floor(totalMinutes / 60);
    const days = (hours / 24).toFixed(1);

    // Son izlenen
    const lastWatched = animes.sort((a, b) => new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime())[0];

    console.log(`${chalk.cyan("toplam anime:")}    ${chalk.bold(totalAnimes)}`);
    console.log(`${chalk.cyan("bitenler:")}        ${chalk.green(completedAnimes)}`);
    console.log(`${chalk.cyan("devam edenler:")}   ${chalk.yellow(watchingAnimes)}`);
    console.log("");
    console.log(`${chalk.cyan("toplam bolum:")}    ${chalk.bold(totalEpisodes)}`);
    console.log(`${chalk.cyan("harcanan sure:")}   ${chalk.bold(hours)} saat ${chalk.gray(`(yaklasik ${days} gun)`)}`);
    console.log("");

    if (lastWatched) {
        console.log(`${chalk.cyan("en son:")}          ${chalk.magenta(lastWatched.name)} ${chalk.gray(`(${timeAgo(new Date(lastWatched.lastWatchedAt))})`)}`);
    }

    await inquirer.prompt([{ type: 'input', name: 'devam', message: 'geri don' }]);
}

/**
 * @param {Date} date
 */
function timeAgo(date) {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " yil once";

    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " ay once";

    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " gun once";

    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " saat once";

    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " dk once";

    return "az once";
}
