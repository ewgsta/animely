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
    console.log(chalk.bold("\nizlediklerim"));
    console.log(chalk.gray(line.repeat(50)));

    const { type } = await inquirer.prompt([{
        type: "list",
        name: "type",
        message: "hangi listeyi goruntulemek istersiniz?",
        choices: [
            { name: "istatistikler", value: "stats" },
            { name: `devam edenler (${inProgress.length})`, value: "progress" },
            { name: `tamamlananlar (${completed.length})`, value: "completed" },
            new inquirer.Separator(),
            { name: "geri don", value: "back" }
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
        console.log(chalk.green("\ntamamlanan animeler"));
        console.log(chalk.gray(line.repeat(50)));

        if (completed.length === 0) {
            console.log(chalk.yellow("henuz tamamlanmis bir anime yok."));
        } else {
            completed.forEach(anime => {
                console.log(`${chalk.cyan(anime.name)} - ${chalk.gray(new Date(anime.lastWatchedAt).toLocaleDateString())}`);
            });
        }

        await inquirer.prompt([{ type: "input", name: "dummy", message: "geri donmek icin enter'a basin..." }]);
        await showHistory();
    } else if (type === "progress") {
        if (inProgress.length === 0) {
            console.log(chalk.yellow("\nhenuz izlenen bir anime yok."));
            await new Promise(resolve => setTimeout(resolve, 1500));
            await showHistory();
            return;
        }

        const { anime } = await inquirer.prompt([{
            type: "list",
            name: "anime",
            message: "detaylarini gormek istediginiz animeyi secin:",
            choices: [
                ...inProgress.map(i => ({
                    name: `${i.name} ${chalk.gray(`(son izlenen: ${i.lastEpisode}. bolum)`)}`,
                    value: i
                })),
                new inquirer.Separator(),
                { name: "geri don", value: "back" }
            ]
        }]);

        if (anime === "back") {
            await showHistory();
            return;
        }

        console.log(chalk.cyan(`\n${anime.name}`));
        console.log(chalk.gray(`son izlenen bolum: ${anime.lastEpisode}`));
        console.log(chalk.gray(`toplam bolum: ${anime.totalEpisodes}`));
        console.log(chalk.gray(`son izleme tarihi: ${new Date(anime.lastWatchedAt).toLocaleString()}`));

        await inquirer.prompt([{ type: "input", name: "dummy", message: "geri donmek icin enter'a basin..." }]);
        await showHistory();
    }
}
