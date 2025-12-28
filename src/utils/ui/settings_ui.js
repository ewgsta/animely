import inquirer from "inquirer";
import chalk from "chalk";
import fs from "fs";
import { getConfig, saveConfig } from "../storage/config.js";
import { successBox } from "./box.js";
import { authenticate, verifyToken } from "../anilist.js";
import { spinner } from "../spinner.js";
import { commandExists, installPackage } from "../system.js";
import { sources, getSourcesByLanguage } from "../../sources/index.js";
import { t, setLanguage } from "../../i18n/index.js";

const pkg = JSON.parse(fs.readFileSync(new URL("./../../../package.json", import.meta.url), "utf-8"));

export async function showSettings() {
    const config = getConfig();
    const currentSource = sources.find(s => s.id === config.defaultSource) || sources[0];
    const currentLang = config.language === "en" ? "English" : "Türkçe";

    console.clear();
    console.log(chalk.bgCyan.black(` ${t("settings.title")} `) + chalk.gray(` v${pkg.version}`));
    console.log();

    const { action } = await inquirer.prompt([{
        type: "list",
        name: "action",
        message: t("settings.whatToChange"),
        pageSize: 15,
        loop: false,
        choices: [
            { name: t("settings.language", { current: chalk.yellow(currentLang) }), value: "language" },
            { name: t("settings.animeSource", { current: chalk.yellow(currentSource.name) }), value: "defaultSource" },
            { name: t("settings.player", { current: chalk.yellow(config.defaultPlayer || t("settings.notSelected")) }), value: "defaultPlayer" },
            { name: t("settings.aria2", { status: chalk.yellow(config.useAria2 ? t("settings.active") : t("settings.inactive")) }), value: "aria2" },
            ...(config.useAria2 ? [{ name: t("settings.aria2Connections", { count: chalk.yellow(config.aria2Connections) }), value: "aria2Connections" }] : []),
            { name: t("settings.ytDlp", { status: chalk.yellow(config.useYtDlp !== false ? t("settings.active") : t("settings.inactive")) }), value: "ytDlp" },
            ...(config.useYtDlp !== false ? [{ name: t("settings.ytDlpConnections", { count: chalk.yellow(config.ytDlpConnections || 16) }), value: "ytDlpConnections" }] : []),
            { name: t("settings.concurrentLimit", { count: chalk.yellow(config.maxConcurrent) }), value: "maxConcurrent" },
            { name: t("settings.downloadLocation", { path: chalk.yellow(config.downloadDir) }), value: "downloadDir" },
            { name: t("settings.retryDownload", { status: chalk.yellow(config.retryEnabled ? t("settings.active") : t("settings.inactive")) }), value: "retryToggle" },
            ...(config.retryEnabled ? [{ name: t("settings.retrySettings", { count: chalk.yellow(config.retryCount), delay: chalk.yellow(config.retryDelay / 1000) }), value: "retrySettings" }] : []),
            { name: t("settings.showDetails", { status: chalk.yellow(config.showAnimeDetails !== false ? t("settings.active") : t("settings.inactive")) }), value: "detailsToggle" },
            { name: t("settings.anilist", { status: chalk.yellow(config.anilistUsername || t("settings.notConnected")) }), value: "anilist" },
            ...(config.anilistToken ? [{ name: t("settings.anilistLogout"), value: "anilistLogout" }] : []),
            new inquirer.Separator(),
            { name: t("settings.backToMenu"), value: "back" }
        ]
    }]);

    if (action === "back") return;

    if (action === "language") {
        const { lang } = await inquirer.prompt([{
            type: "list",
            name: "lang",
            message: t("settings.selectLanguage"),
            choices: [
                { name: t("settings.turkish"), value: "tr" },
                { name: t("settings.english"), value: "en" }
            ],
            default: config.language || "tr"
        }]);

        config.language = lang;
        setLanguage(lang);
        
        const availableSources = getSourcesByLanguage(lang);
        const currentSourceValid = availableSources.some(s => s.id === config.defaultSource);
        if (!currentSourceValid && availableSources.length > 0) {
            config.defaultSource = availableSources[0].id;
        }
        
        saveConfig(config);
        successBox(t("settings.languageUpdated"));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }

    if (action === "defaultSource") {
        const currentLangCode = config.language || "tr";
        const availableSources = getSourcesByLanguage(currentLangCode);

        const { source } = await inquirer.prompt([{
            type: "list",
            name: "source",
            message: t("settings.selectSource"),
            choices: availableSources.map(s => ({
                name: `${s.name}${s.supportsLocalSearch ? chalk.gray(` (${t("settings.advancedSearch")})`) : ""}`,
                value: s.id
            })),
            default: config.defaultSource || availableSources[0]?.id
        }]);

        config.defaultSource = source;
        saveConfig(config);
        successBox(t("settings.sourceUpdated"));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }

    if (action === "detailsToggle") {
        config.showAnimeDetails = config.showAnimeDetails === false ? true : false;
        saveConfig(config);
        successBox(config.showAnimeDetails ? t("settings.detailsEnabled") : t("settings.detailsDisabled"));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }


    if (action === "anilistLogout") {
        const { confirm } = await inquirer.prompt([{
            type: "confirm",
            name: "confirm",
            message: t("settings.anilistDisconnectConfirm"),
            default: false
        }]);

        if (confirm) {
            config.anilistToken = undefined;
            config.anilistUsername = undefined;
            saveConfig(config);
            console.log(chalk.yellow("\n" + t("settings.anilistDisconnected")));
        } else {
            console.log(chalk.gray(t("settings.operationCancelled")));
        }

        await new Promise(resolve => setTimeout(resolve, 1500));
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
            spinner.start(t("anilist.verifying"));
            const username = await verifyToken(token);
            spinner.stop();

            if (username) {
                config.anilistToken = token;
                config.anilistUsername = username;
                console.log(chalk.green(`\n${t("anilist.loginSuccess", { username })}`));
            } else {
                console.log(chalk.red("\n" + t("anilist.verifyFailed")));
            }
        } catch (error) {
            console.log(chalk.red("\n" + t("anilist.loginFailed", { message: error.message })));
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
            message: t("settings.selectPlayer"),
            choices: [
                { name: t("setup.mpvWithResume"), value: "mpv" },
                { name: t("setup.vlcPlayer"), value: "vlc" }
            ],
            default: config.defaultPlayer || "mpv"
        }]);

        if (!commandExists(player)) {
            console.log(chalk.yellow(`\n${t("settings.playerNotFound", { player })}`));
            const { install } = await inquirer.prompt([{
                type: "confirm",
                name: "install",
                message: t("settings.autoInstallPrompt"),
                default: true
            }]);

            if (install) {
                console.log(chalk.yellow(t("settings.installingPlayer")));
                const success = installPackage(player);
                if (success) {
                    console.log(chalk.green(`\n${t("settings.playerInstalled", { player })}`));
                } else {
                    console.log(chalk.red("\n" + t("settings.installFailed")));
                }
            }
        }

        config.defaultPlayer = player;
        saveConfig(config);
        successBox(t("settings.playerUpdated"));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }

    if (action === "maxConcurrent") {
        const { limit } = await inquirer.prompt([{
            type: "number",
            name: "limit",
            message: t("settings.concurrentPrompt"),
            default: config.maxConcurrent,
            validate: (input) => (input > 0 && input <= 10) ? true : t("settings.concurrentValidation")
        }]);
        config.maxConcurrent = limit;
        saveConfig(config);
        successBox(t("settings.concurrentUpdated"));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }

    if (action === "aria2") {
        config.useAria2 = !config.useAria2;
        saveConfig(config);
        successBox(config.useAria2 ? t("settings.aria2Enabled") : t("settings.aria2Disabled"));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }

    if (action === "aria2Connections") {
        const { connections } = await inquirer.prompt([{
            type: "number",
            name: "connections",
            message: t("settings.aria2ConnectionsPrompt"),
            default: config.aria2Connections || 16,
            validate: (input) => (input > 0 && input <= 32) ? true : t("settings.aria2ConnectionsValidation")
        }]);
        config.aria2Connections = connections;
        saveConfig(config);
        successBox(t("settings.aria2ConnectionsUpdated"));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }

    if (action === "ytDlp") {
        config.useYtDlp = config.useYtDlp === false ? true : false;
        saveConfig(config);
        successBox(config.useYtDlp ? t("settings.ytDlpEnabled") : t("settings.ytDlpDisabled"));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }

    if (action === "ytDlpConnections") {
        const { connections } = await inquirer.prompt([{
            type: "number",
            name: "connections",
            message: t("settings.ytDlpConnectionsPrompt"),
            default: config.ytDlpConnections || 16,
            validate: (input) => (input > 0 && input <= 32) ? true : t("settings.ytDlpConnectionsValidation")
        }]);
        config.ytDlpConnections = connections;
        saveConfig(config);
        successBox(t("settings.ytDlpConnectionsUpdated"));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }


    if (action === "downloadDir") {
        const { dir } = await inquirer.prompt([{
            type: "input",
            name: "dir",
            message: t("settings.downloadDirPrompt"),
            default: config.downloadDir,
            validate: (input) => input.trim() !== "" ? true : t("settings.downloadDirValidation")
        }]);
        config.downloadDir = dir;
        saveConfig(config);
        successBox(t("settings.downloadDirUpdated"));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }

    if (action === "retryToggle") {
        config.retryEnabled = !config.retryEnabled;
        successBox(config.retryEnabled ? t("settings.retryEnabled") : t("settings.retryDisabled"));
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
                message: t("settings.retryCountPrompt"),
                default: config.retryCount,
                validate: (input) => (input >= 0 && input <= 10) ? true : t("settings.retryCountValidation")
            },
            {
                type: "number",
                name: "delay",
                message: t("settings.retryDelayPrompt"),
                default: config.retryDelay / 1000,
                validate: (input) => (input >= 0) ? true : t("settings.retryDelayValidation")
            }
        ]);

        config.retryCount = count;
        config.retryDelay = delay * 1000;

        saveConfig(config);
        successBox(t("settings.retryUpdated"));
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }
}
