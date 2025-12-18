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
        message: "degistirmek istediginiz ayari secin:",
        choices: [
            { name: `varsayilan oynatici (su an: ${chalk.yellow(config.defaultPlayer || "secilmedi")})`, value: "defaultPlayer" },
            { name: `eszamanli indirme sayisi (su an: ${chalk.yellow(config.maxConcurrent)})`, value: "maxConcurrent" },
            { name: `indirme klasoru (su an: ${chalk.yellow(config.downloadDir)})`, value: "downloadDir" },
            { name: `anilist hesabi (su an: ${chalk.yellow(config.anilistUsername || "bagli degil")})`, value: "anilist" },
            new inquirer.Separator(),
            { name: "geri don", value: "back" }
        ]
    }]);

    if (action === "back") return;

    if (action === "anilist") {
        const choices = [];

        if (config.anilistToken) {
            choices.push({ name: "baglantiyi kaldir", value: "logout" });
        } else {
            choices.push({ name: "anilist'e baglan", value: "auto" });
        }

        choices.push({ name: "iptal", value: "cancel" });

        const { method } = await inquirer.prompt([{
            type: "list",
            name: "method",
            message: "seciminiz:",
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
            console.log(chalk.yellow("\nanilist baglantisi kaldirildi."));
            await new Promise(resolve => setTimeout(resolve, 1500));
            await showSettings();
            return;
        } else if (method === "auto") {
            try {
                const token = await authenticate();
                spinner.start("token dogrulaniyor...");
                const username = await verifyToken(token);
                spinner.stop();

                if (username) {
                    config.anilistToken = token;
                    config.anilistUsername = username;
                    console.log(chalk.green(`\nbasariyla giris yapildi! hosgeldin ${username}`));
                } else {
                    console.log(chalk.red("\ntoken alindi fakat dogrulanamadi."));
                }
            } catch (error) {
                console.log(chalk.red("\ngiris yapilamadi: " + error.message));
            }
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    } else if (action === "defaultPlayer") {
        const { player } = await inquirer.prompt([{
            type: "list",
            name: "player",
            message: "varsayilan oynaticiyi secin:",
            choices: [
                { name: "VLC Media Player", value: "vlc" },
                { name: "MPV Player", value: "mpv" }
            ],
            default: config.defaultPlayer || "vlc"
        }]);
        config.defaultPlayer = player;
    } else if (action === "maxConcurrent") {
        const { limit } = await inquirer.prompt([{
            type: "number",
            name: "limit",
            message: "yeni eszamanli indirme sayisi (1-10 arasi):",
            default: config.maxConcurrent,
            validate: (input) => (input > 0 && input <= 10) ? true : "lutfen 1 ile 10 arasinda bir sayi girin."
        }]);
        config.maxConcurrent = limit;
    } else if (action === "downloadDir") {
        const { dir } = await inquirer.prompt([{
            type: "input",
            name: "dir",
            message: "yeni indirme klasoru:",
            default: config.downloadDir,
            validate: (input) => input.trim() !== "" ? true : "gecerli bir klasor yolu girin."
        }]);
        config.downloadDir = dir;
    }

    saveConfig(config);
    console.log(chalk.green("\nayarlar basariyla kaydedildi!"));
    await new Promise(resolve => setTimeout(resolve, 1000));
    await showSettings();
}
