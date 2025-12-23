import inquirer from "inquirer";
import chalk from "chalk";
import { loadHistory } from "./history.js";
import { line } from "../functions/variables.js";

import { stats } from "./stats.js";

export async function showHistory() {
    const history = loadHistory();
    const items = Object.values(history);

    const completed = items.filter(i => i.completed);
    const inProgress = items.filter(i => !i.completed);

    console.clear();
    console.log(chalk.bold("\nİzleme Geçmişi"));
    console.log(chalk.gray(line.repeat(50)));

    const { type } = await inquirer.prompt([{
        type: "list",
        name: "type",
        message: "Hangi listeyi görüntülemek istersiniz?",
        choices: [
            { name: "İstatistikler", value: "stats" },
            { name: `Devam Edenler (${inProgress.length})`, value: "progress" },
            { name: `Tamamlananlar (${completed.length})`, value: "completed" },
            new inquirer.Separator(),
            { name: "Geri Dön", value: "back" }
        ]
    }]);

    if (type === "back") return;

    if (type === "stats") {
        await stats();
        await showHistory();
        return;
    }

    if (type === "completed") {
        console.clear();
        console.log(chalk.green("\nTamamlanan Animeler"));
        console.log(chalk.gray(line.repeat(50)));

        if (completed.length === 0) {
            console.log(chalk.yellow("Henüz tamamlanmış bir anime yok."));
        } else {
            completed.forEach(anime => {
                console.log(`${chalk.cyan(anime.name)} - ${chalk.gray(new Date(anime.lastWatchedAt).toLocaleDateString())}`);
            });
        }

        await inquirer.prompt([{ type: "input", name: "dummy", message: "Geri dönmek için Enter'a basın..." }]);
        await showHistory();
    } else if (type === "progress") {
        if (inProgress.length === 0) {
            console.log(chalk.yellow("\nHenüz izlenen bir anime yok."));
            await new Promise(resolve => setTimeout(resolve, 1500));
            await showHistory();
            return;
        }

        const { anime } = await inquirer.prompt([{
            type: "list",
            name: "anime",
            message: "Detaylarını görmek istediğiniz animeyi seçin:",
            choices: [
                ...inProgress.map(i => ({
                    name: `${i.name} ${chalk.gray(`(Son izlenen: ${i.lastEpisode}. Bölüm)`)}`,
                    value: i
                })),
                new inquirer.Separator(),
                { name: "Geri Dön", value: "back" }
            ]
        }]);

        if (anime === "back") {
            await showHistory();
            return;
        }

        console.log(chalk.cyan(`\n${anime.name}`));
        console.log(chalk.gray(`Son izlenen bölüm: ${anime.lastEpisode}`));
        console.log(chalk.gray(`Toplam bölüm: ${anime.totalEpisodes}`));
        console.log(chalk.gray(`Son izleme tarihi: ${new Date(anime.lastWatchedAt).toLocaleString()}`));

        await inquirer.prompt([{ type: "input", name: "dummy", message: "Geri dönmek için Enter'a basın..." }]);
        await showHistory();
    }
}
