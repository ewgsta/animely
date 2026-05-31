import inquirer from "inquirer";
import chalk from "chalk";
import { loadHistory } from "../storage/history.js";
import { stats } from "./stats.js";
import { t } from "../../i18n/index.js";

export async function showHistory() {
    const history = loadHistory();
    const items = Object.values(history);

    const completed = items.filter(i => i.completed);
    const inProgress = items.filter(i => !i.completed);

    console.clear();
    console.log(chalk.bgMagenta.black(` ${t("history.title")} `));
    console.log("");

    const { type } = await inquirer.prompt([{
        type: "list",
        name: "type",
        message: t("history.selectList"),
        loop: false,
        choices: [
            { name: t("history.statistics"), value: "stats" },
            { name: t("history.inProgress", { count: inProgress.length }), value: "progress" },
            { name: t("history.completed", { count: completed.length }), value: "completed" },
            new inquirer.Separator(),
            { name: t("history.goBack"), value: "back" }
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
        console.log(chalk.bgGreen.black(` ${t("history.completedTitle")} `));
        console.log("");

        if (completed.length === 0) {
            console.log(chalk.yellow("  " + t("history.noCompleted")));
        } else {
            completed.forEach(anime => {
                console.log(`  ${chalk.cyan("●")} ${chalk.white(anime.name)} ${chalk.gray(`- ${new Date(anime.lastWatchedAt).toLocaleDateString()}`)}`);
            });
        }
        console.log("");

        await inquirer.prompt([{ type: "input", name: "dummy", message: t("history.pressEnter") }]);
        await showHistory();
    } else if (type === "progress") {
        if (inProgress.length === 0) {
            console.log(chalk.yellow("\n" + t("history.noWatching")));
            await new Promise(resolve => setTimeout(resolve, 1500));
            await showHistory();
            return;
        }

        const { anime } = await inquirer.prompt([{
            type: "list",
            name: "anime",
            message: t("history.selectForDetails"),
            loop: false,
            choices: [
                ...inProgress.map(i => ({
                    name: `${i.name} ${chalk.gray(`(${t("history.lastEpisode", { episode: i.lastEpisode })})`)}`,
                    value: i
                })),
                new inquirer.Separator(),
                { name: t("history.goBack"), value: "back" }
            ]
        }]);

        if (anime === "back") {
            await showHistory();
            return;
        }

        console.log(chalk.cyan(`\n${anime.name}`));
        console.log(chalk.gray(t("history.lastEpisodeLabel", { episode: anime.lastEpisode })));
        console.log(chalk.gray(t("history.totalEpisodes", { count: anime.totalEpisodes })));
        console.log(chalk.gray(t("history.lastWatchedDate", { date: new Date(anime.lastWatchedAt).toLocaleString() })));

        await inquirer.prompt([{ type: "input", name: "dummy", message: t("history.pressEnter") }]);
        await showHistory();
    }
}
