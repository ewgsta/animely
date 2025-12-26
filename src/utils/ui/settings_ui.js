import inquirer from "inquirer";
import chalk from "chalk";
import fs from "fs";
import { getConfig, saveConfig } from "../storage/config.js";
import { successBox } from "./box.js";
import { authenticate, verifyToken } from "../anilist.js";
import { spinner } from "../spinner.js";
import { commandExists, installPackage } from "../system.js";
import { sources } from "../../sources/index.js";

const pkg = JSON.parse(fs.readFileSync(new URL("./../../../package.json", import.meta.url), "utf-8"));

export async function showSettings() {
    const config = getConfig();
    const currentSource = sources.find(s => s.id === config.defaultSource) || sources[0];

    console.clear();
    console.log(chalk.bgCyan.black(` Ayarlar `) + chalk.gray(` v${pkg.version}`));
    console.log();

    const { action } = await inquirer.prompt([{
        type: "list",
        name: "action",
        message: 'Neyi değiştirmek istersin?',
        pageSize: 15,
        loop: false,
        choices: [
            { name: `Anime Kaynağı (Mevcut: ${chalk.yellow(currentSource.name)})`, value: "defaultSource" },
            { name: `Oynatıcı (Mevcut: ${chalk.yellow(config.defaultPlayer || "Seçilmedi")})`, value: "defaultPlayer" },
            { name: `İndirme Yöneticisi (Aria2) (${chalk.yellow(config.useAria2 ? "Aktif" : "Pasif")})`, value: "aria2" },
            ...(config.useAria2 ? [{ name: `   ↳ Aria2 Bağlantı Sayısı (Mevcut: ${chalk.yellow(config.aria2Connections)}x)`, value: "aria2Connections" }] : []),
            { name: `Eşzamanlı İndirme Limiti (Mevcut: ${chalk.yellow(config.maxConcurrent)})`, value: "maxConcurrent" },
            { name: `İndirme Konumu (Mevcut: ${chalk.yellow(config.downloadDir)})`, value: "downloadDir" },
            { name: `İndirme Tekrarı (Mevcut: ${chalk.yellow(config.retryEnabled ? "Aktif" : "Pasif")})`, value: "retryToggle" },
            ...(config.retryEnabled ? [{ name: `   ↳ Tekrar Ayarları (Mevcut: ${chalk.yellow(config.retryCount)}x / ${chalk.yellow(config.retryDelay / 1000)}sn)`, value: "retrySettings" }] : []),
            { name: `Anime Detaylarını Göster (Mevcut: ${chalk.yellow(config.showAnimeDetails !== false ? "Aktif" : "Pasif")})`, value: "detailsToggle" },
            { name: `Anilist Entegrasyonu (Durum: ${chalk.yellow(config.anilistUsername || "Bağlı Değil")})`, value: "anilist" },
            ...(config.anilistToken ? [{ name: "   ↳ Bağlantıyı Kes", value: "anilistLogout" }] : []),
            { name: `Telemetri (Anonim) (Durum: ${chalk.yellow(config.telemetryEnabled ? "Aktif" : "Pasif")})`, value: "telemetryToggle" },
            new inquirer.Separator(),
            { name: "Ana Menüye Dön", value: "back" }
        ]
    }]);

    if (action === "back") return;

    if (action === "defaultSource") {
        const { source } = await inquirer.prompt([{
            type: "list",
            name: "source",
            message: "Anime kaynağını seçin:",
            choices: sources.map(s => ({
                name: `${s.name}${s.supportsLocalSearch ? chalk.gray(" (Gelişmiş arama)") : ""}`,
                value: s.id
            })),
            default: config.defaultSource || "animely"
        }]);

        config.defaultSource = source;
        saveConfig(config);
        successBox("Anime kaynağı güncellendi.");
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }

    if (action === "detailsToggle") {
        config.showAnimeDetails = config.showAnimeDetails === false ? true : false;
        saveConfig(config);
        successBox(`Anime detay görünümü ${config.showAnimeDetails ? "etkinleştirildi" : "devre dışı bırakıldı"}.`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }


    if (action === "anilistLogout") {
        const { confirm } = await inquirer.prompt([{
            type: "confirm",
            name: "confirm",
            message: "Anilist bağlantısını kesmek istediğinize emin misiniz?",
            default: false
        }]);

        if (confirm) {
            config.anilistToken = undefined;
            config.anilistUsername = undefined;
            saveConfig(config);
            console.log(chalk.yellow("\nAnilist bağlantısı kesildi."));
        } else {
            console.log(chalk.gray("İşlem iptal edildi."));
        }

        await new Promise(resolve => setTimeout(resolve, 1500));
        await showSettings();
        return;
    }

    if (action === "telemetryToggle") {
        config.telemetryEnabled = !config.telemetryEnabled;
        saveConfig(config);
        successBox(`Telemetri ${config.telemetryEnabled ? "etkinleştirildi" : "devre dışı bırakıldı"}.`);
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
            spinner.start("Token doğrulanıyor...");
            const username = await verifyToken(token);
            spinner.stop();

            if (username) {
                config.anilistToken = token;
                config.anilistUsername = username;
                console.log(chalk.green(`\nGiriş başarılı! Hoş geldiniz, ${username}.`));
            } else {
                console.log(chalk.red("\nToken alındı ancak doğrulama başarısız oldu."));
            }
        } catch (error) {
            console.log(chalk.red("\nGiriş yapılamadı: " + error.message));
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
            message: "Varsayılan oynatıcıyı seçin:",
            choices: [
                { name: "MPV Player (Önerilen - Kaldığı yerden devam desteği)", value: "mpv" },
                { name: "VLC Media Player", value: "vlc" }
            ],
            default: config.defaultPlayer || "mpv"
        }]);

        if (!commandExists(player)) {
            console.log(chalk.yellow(`\nUyarı: ${player} sistemde bulunamadı.`));
            const { install } = await inquirer.prompt([{
                type: "confirm",
                name: "install",
                message: "Otomatik olarak yüklemek ister misiniz?",
                default: true
            }]);

            if (install) {
                console.log(chalk.yellow("Yükleme başlatılıyor, lütfen bekleyin..."));
                const success = installPackage(player);
                if (success) {
                    console.log(chalk.green(`\n${player} başarıyla yüklendi!`));
                } else {
                    console.log(chalk.red("\nYükleme başarısız oldu. Yine de oynatıcı olarak seçildi."));
                }
            }
        }

        config.defaultPlayer = player;
        saveConfig(config);
        successBox("Varsayılan oynatıcı güncellendi.");
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }

    if (action === "maxConcurrent") {
        const { limit } = await inquirer.prompt([{
            type: "number",
            name: "limit",
            message: "Eşzamanlı indirme sayısı (1-10):",
            default: config.maxConcurrent,
            validate: (input) => (input > 0 && input <= 10) ? true : "Lütfen 1 ile 10 arasında bir değer girin."
        }]);
        config.maxConcurrent = limit;
        saveConfig(config);
        successBox("İndirme limiti güncellendi.");
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }

    if (action === "aria2") {
        config.useAria2 = !config.useAria2;
        saveConfig(config);
        successBox(`Aria2 ${config.useAria2 ? "etkinleştirildi" : "devre dışı bırakıldı"}.`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }

    if (action === "aria2Connections") {
        const { connections } = await inquirer.prompt([{
            type: "number",
            name: "connections",
            message: "Aria2 bağlantı sayısı (1-32):",
            default: config.aria2Connections || 16,
            validate: (input) => (input > 0 && input <= 32) ? true : "Lütfen 1 ile 32 arasında bir değer girin."
        }]);
        config.aria2Connections = connections;
        saveConfig(config);
        successBox("Aria2 bağlantı sayısı güncellendi.");
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }


    if (action === "downloadDir") {
        const { dir } = await inquirer.prompt([{
            type: "input",
            name: "dir",
            message: "Yeni indirme konumu:",
            default: config.downloadDir,
            validate: (input) => input.trim() !== "" ? true : "Bu alan boş bırakılamaz."
        }]);
        config.downloadDir = dir;
        saveConfig(config);
        successBox("İndirme konumu güncellendi.");
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }

    if (action === "retryToggle") {
        config.retryEnabled = !config.retryEnabled;
        successBox(`İndirme tekrarı ${config.retryEnabled ? "etkinleştirildi" : "devre dışı bırakıldı"}.`);
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
                message: "Maksimum tekrar deneme sayısı (0-10):",
                default: config.retryCount,
                validate: (input) => (input >= 0 && input <= 10) ? true : "Lütfen 0 ile 10 arasında bir değer girin."
            },
            {
                type: "number",
                name: "delay",
                message: "Tekrarlar arası bekleme süresi (saniye):",
                default: config.retryDelay / 1000,
                validate: (input) => (input >= 0) ? true : "Lütfen pozitif bir değer girin."
            }
        ]);

        config.retryCount = count;
        config.retryDelay = delay * 1000;

        saveConfig(config);
        successBox("Tekrar ayarları güncellendi.");
        await new Promise(resolve => setTimeout(resolve, 1000));
        await showSettings();
        return;
    }
}
