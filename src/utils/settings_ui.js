import inquirer from "inquirer";
import chalk from "chalk";
import { exec } from "child_process";
import { getConfig, saveConfig } from "./config.js";
import { line } from "../functions/variables.js";
import { authenticate, verifyToken } from "./anilist.js";
import { spinner } from "./spinner.js";
import { AUTH_URL } from "../constants.js";

export async function showSettings() {
    const config = getConfig();

    console.clear();
    console.log(chalk.bold("\nayarlar"));
    console.log(chalk.gray(line.repeat(50)));

    const { action } = await inquirer.prompt([{
        type: "list",
        name: "action",
        message: "ne degisecek:",
        choices: [
            { name: `oynatici (su an: ${chalk.yellow(config.defaultPlayer || "yok")})`, value: "defaultPlayer" },
            { name: `ayni anda indirme (su an: ${chalk.yellow(config.maxConcurrent)})`, value: "maxConcurrent" },
            { name: `indirme klasoru (su an: ${chalk.yellow(config.downloadDir)})`, value: "downloadDir" },
            { name: `indirme tekrari (su an: ${chalk.yellow(config.retryCount)}x / ${chalk.yellow(config.retryDelay / 1000)}sn)`, value: "retrySettings" },
            { name: `anilist baglantisi (su an: ${chalk.yellow(config.anilistUsername || "bagli degil")})`, value: "anilist" },
            new inquirer.Separator(),
            { name: "geri", value: "back" }
        ]
    }]);

    if (action === "back") return;
    if (action === "anilist") {
        const choices = [];

        if (config.anilistToken) {
            choices.push({ name: "baglantiyi kopar", value: "logout" });
        } else {
            choices.push({ name: "baglan", value: "auto" });
        }

        choices.push({ name: "iptal", value: "cancel" });

        const { method } = await inquirer.prompt([{
            type: "list",
            name: "method",
            message: "ne yapalim:",
            choices
        }]);

        if (method === "cancel") {
            await showSettings();
            return;
        }

        if (method === "logout") {
            config.anilistToken = undefined;
            config.anilistUsername = undefined;
            saveConfig(config);
            console.log(chalk.yellow("\nanilist koptu"));
            await new Promise(resolve => setTimeout(resolve, 1500));
            await showSettings();
            return;
        } else if (method === "auto") {
            try {
                const token = await authenticate();
                spinner.start("dogruluyorum...");
                const username = await verifyToken(token);
                spinner.stop();

                if (username) {
                    config.anilistToken = token;
                    config.anilistUsername = username;
                    console.log(chalk.green(`\ngiris yapildi, hosgeldin ${username}`));
                } else {
                    console.log(chalk.red("\ntoken geldi ama dogrulayamadim"));
                }
            } catch (error) {
                console.log(chalk.red("\ngiris yapamadim: " + error.message));
            }
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    } else if (action === "defaultPlayer") {
        const { player } = await inquirer.prompt([{
            type: "list",
            name: "player",
            message: "sec bakalim:",
            choices: [
                { name: "vlc media player", value: "vlc" },
                { name: "mpv player", value: "mpv" }
            ],
            default: config.defaultPlayer || "vlc"
        }]);
        config.defaultPlayer = player;
    } else if (action === "maxConcurrent") {
        const { limit } = await inquirer.prompt([{
            type: "number",
            name: "limit",
            message: "ayni anda kac indirme olsun (1-10):",
            default: config.maxConcurrent,
            validate: (input) => (input > 0 && input <= 10) ? true : "1 ile 10 arasi girj"
        }]);
        config.maxConcurrent = limit;
    } else if (action === "downloadDir") {
        const { dir } = await inquirer.prompt([{
            type: "input",
            name: "dir",
            message: "yeni klasor yolu:",
            default: config.downloadDir,
            validate: (input) => input.trim() !== "" ? true : "bos gecme"
        }]);
        config.downloadDir = dir;
    } else if (action === "retrySettings") {
        const { count, delay } = await inquirer.prompt([
            {
                type: "number",
                name: "count",
                message: "hata olursa kac kere denesin (0-10):",
                default: config.retryCount,
                validate: (input) => (input >= 0 && input <= 10) ? true : "0-10 arasi gir"
            },
            {
                type: "number",
                name: "delay",
                message: "kac sn beklesin:",
                default: config.retryDelay / 1000,
                validate: (input) => (input >= 0) ? true : "pozitif gir"
            }
        ]);

        config.retryCount = count;
        config.retryDelay = delay * 1000;
    }

    saveConfig(config);
    console.log(chalk.green("\nayarlar tamam"));
    await new Promise(resolve => setTimeout(resolve, 1000));
    await showSettings();
}
