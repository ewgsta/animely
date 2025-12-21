import inquirer from "inquirer";
import chalk from "chalk";
import { getConfig, saveConfig } from "./config.js";
import { line } from "../functions/variables.js";
import { authenticate, verifyToken } from "./anilist.js";
import { spinner } from "./spinner.js";
import { AUTH_URL } from "../constants.js";
import { commandExists, installPackage } from "./system.js";

export async function showSettings() {
    const config = getConfig();

    console.clear();

    const { action } = await inquirer.prompt([{
        type: "list",
        name: "action",
        message: "ne degisecek:",
        pageSize: 15,
        choices: [
            { name: `oynatici (su an: ${chalk.yellow(config.defaultPlayer || "yok")})`, value: "defaultPlayer" },
            { name: `hizlandirici (aria2) (su an: ${chalk.yellow(config.useAria2 ? "acik" : "kapali")})`, value: "aria2" },
            ...(config.useAria2 ? [{ name: `   ↳ aria2 baglanti (su an: ${chalk.yellow(config.aria2Connections)}x)`, value: "aria2Connections" }] : []),
            { name: `ayni anda indirme (su an: ${chalk.yellow(config.maxConcurrent)})`, value: "maxConcurrent" },
            { name: `indirme klasoru (su an: ${chalk.yellow(config.downloadDir)})`, value: "downloadDir" },
            { name: `indirme tekrari (su an: ${chalk.yellow(config.retryEnabled ? "acik" : "kapali")})`, value: "retryToggle" },
            ...(config.retryEnabled ? [{ name: `   ↳ tekrar ayarlari (su an: ${chalk.yellow(config.retryCount)}x / ${chalk.yellow(config.retryDelay / 1000)}sn)`, value: "retrySettings" }] : []),
            { name: `anilist baglantisi (su an: ${chalk.yellow(config.anilistUsername || "bagli degil")})`, value: "anilist" },
            ...(config.anilistToken ? [{ name: "   ↳ baglantiyi kaldir", value: "anilistLogout" }] : []),
            { name: `telemetri (su an: ${chalk.yellow(config.telemetryEnabled ? "acik" : "kapali")})`, value: "telemetryToggle" },
            new inquirer.Separator(),
            { name: "geri don", value: "back" }
        ]
    }]);

    if (action === "back") return;

    // ... (aria2 and anilist handlers remain the same)

    if (action === "anilistLogout") {
        const { confirm } = await inquirer.prompt([{
            type: "confirm",
            name: "confirm",
            message: "anilist baglantisini koparmak istedigine emin misin?",
            default: false
        }]);

        if (confirm) {
            config.anilistToken = undefined;
            config.anilistUsername = undefined;
            saveConfig(config);
            console.log(chalk.yellow("\nanilist koptu"));
        } else {
            console.log(chalk.gray("iptal edildi"));
        }

        await new Promise(resolve => setTimeout(resolve, 1500));
        await showSettings();
        return;
    }

    if (action === "telemetryToggle") {
        config.telemetryEnabled = !config.telemetryEnabled;
        saveConfig(config);
        console.log(chalk.green(`\ntelemetri ${config.telemetryEnabled ? "acildi" : "kapatildi"}`));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }

    if (action === "anilist") {
        if (config.anilistToken) {
            await showSettings();
            return;
        }

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
        await new Promise(resolve => setTimeout(resolve, 2000));
        saveConfig(config);
        await showSettings();
        return;
    }

    if (action === "defaultPlayer") {
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

        if (!commandExists(player)) {
            console.log(chalk.yellow(`\n${player} sistemde bulunamadi.`));
            const { install } = await inquirer.prompt([{
                type: "confirm",
                name: "install",
                message: "otomatik kurayim mi?",
                default: true
            }]);

            if (install) {
                console.log(chalk.yellow("kuruluyor..."));
                const success = installPackage(player);
                if (success) {
                    console.log(chalk.green(`\n${player} kuruldu!`));
                } else {
                    console.log(chalk.red("\nkurulum basarisiz, ama yine de oynatici olarak sectim."));
                }
            }
        }

        config.defaultPlayer = player;
        saveConfig(config);
        console.log(chalk.green("\noynatici degistirildi"));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }

    if (action === "maxConcurrent") {
        const { limit } = await inquirer.prompt([{
            type: "number",
            name: "limit",
            message: "ayni anda kac indirme olsun (1-10):",
            default: config.maxConcurrent,
            validate: (input) => (input > 0 && input <= 10) ? true : "1 ile 10 arasi girj"
        }]);
        config.maxConcurrent = limit;
        saveConfig(config);
        console.log(chalk.green("\nlimit ayarlandi"));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }

    if (action === "downloadDir") {
        const { dir } = await inquirer.prompt([{
            type: "input",
            name: "dir",
            message: "yeni klasor yolu:",
            default: config.downloadDir,
            validate: (input) => input.trim() !== "" ? true : "bos gecme"
        }]);
        config.downloadDir = dir;
        saveConfig(config);
        console.log(chalk.green("\nklasor degisti"));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }

    if (action === "retryToggle") {
        config.retryEnabled = !config.retryEnabled;
        console.log(chalk.green(`\nindirme tekrari ${config.retryEnabled ? "acildi" : "kapatildi"}`));
        await new Promise(resolve => setTimeout(resolve, 1000));
        saveConfig(config);
        await showSettings();
        return;
    }

    if (action === "retrySettings") {
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

        saveConfig(config);
        console.log(chalk.green("\ntekrar ayarlari guncellendi"));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }
}
