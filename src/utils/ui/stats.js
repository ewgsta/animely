// @ts-check
import chalk from "chalk";
import inquirer from "inquirer";
import { loadHistory } from "../storage/history.js";

export async function stats() {
    console.clear();
    const history = loadHistory();
    const animes = Object.values(history);

    if (animes.length === 0) {
        console.log(chalk.yellow("İzleme geçmişiniz henüz boş..."));
        await inquirer.prompt([{ type: 'input', name: 'devam', message: 'Geri dönmek için Enter\'a basın' }]);
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

    console.log(`${chalk.cyan("Toplam Anime:")}    ${chalk.bold(totalAnimes)}`);
    console.log(`${chalk.cyan("Tamamlananlar:")}   ${chalk.green(completedAnimes)}`);
    console.log(`${chalk.cyan("Devam Edenler:")}   ${chalk.yellow(watchingAnimes)}`);
    console.log("");
    console.log(`${chalk.cyan("Toplam Bölüm:")}    ${chalk.bold(totalEpisodes)}`);
    console.log(`${chalk.cyan("İzleme Süresi:")}   ${chalk.bold(hours)} saat ${chalk.gray(`(yaklaşık ${days} gün)`)}`);
    console.log("");

    if (lastWatched) {
        console.log(`${chalk.cyan("Son İzlenen:")}     ${chalk.magenta(lastWatched.name)} ${chalk.gray(`(${timeAgo(new Date(lastWatched.lastWatchedAt))})`)}`);
    }

    await inquirer.prompt([{ type: 'input', name: 'devam', message: 'Geri dönmek için Enter\'a basın' }]);
}

/**
 * @param {Date} date
 */
function timeAgo(date) {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " yıl önce";

    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " ay önce";

    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " gün önce";

    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " saat önce";

    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " dk önce";

    return "az önce";
}
