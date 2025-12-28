// @ts-check
import { spawnSync, execSync } from "child_process";
import os from "os";
import chalk from "chalk";
import { t } from "../i18n/index.js";

/**
 * @returns {"windows" | "linux" | "macos" | "unknown"}
 */
export function getOS() {
    const platform = os.platform();
    if (platform === "win32") return "windows";
    if (platform === "darwin") return "macos";
    if (platform === "linux") return "linux";
    return "unknown";
}

/**
 * @type {Object.<string, {cmd: string, win: string, mac: string, linux: string}>}
 */
const PACKAGES = {
    aria2: {
        cmd: "aria2c",
        win: "aria2.aria2",
        mac: "aria2",
        linux: "aria2"
    },
    vlc: {
        cmd: "vlc",
        win: "VideoLAN.VLC",
        mac: "--cask vlc",
        linux: "vlc"
    },
    mpv: {
        cmd: "mpv",
        win: "mpv.mpv",
        mac: "mpv",
        linux: "mpv"
    },
    ffmpeg: {
        cmd: "ffmpeg",
        win: "Gyan.FFmpeg",
        mac: "ffmpeg",
        linux: "ffmpeg"
    },
    "yt-dlp": {
        cmd: "yt-dlp",
        win: "yt-dlp.yt-dlp",
        mac: "yt-dlp",
        linux: "yt-dlp"
    }
};

/**
 * @param {string} program
 * @returns {boolean}
 */
export function commandExists(program) {
    const osType = getOS();
    const pkg = PACKAGES[program] || { cmd: program };
    const command = pkg.cmd;

    try {
        if (osType === "windows") {
            try {
                execSync(`where ${command}`, { stdio: "ignore" });
                return true;
            } catch {
                const paths = [
                    `C:\\Program Files\\VideoLAN\\VLC\\vlc.exe`,
                    `C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe`,
                    `C:\\Program Files\\MPV\\mpv.exe`,
                    `C:\\ProgramData\\chocolatey\\bin\\mpv.exe`,
                    `${process.env.USERPROFILE}\\scoop\\apps\\mpv\\current\\mpv.exe`
                ];

                if (program === 'vlc') {
                    if (require('fs').existsSync('C:\\Program Files\\VideoLAN\\VLC\\vlc.exe')) return true;
                    if (require('fs').existsSync('C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe')) return true;
                }

                if (program === 'mpv') {
                    if (require('fs').existsSync('C:\\Program Files\\MPV\\mpv.exe')) return true;
                    if (require('fs').existsSync('C:\\ProgramData\\chocolatey\\bin\\mpv.exe')) return true;
                    if (require('fs').existsSync(`${process.env.USERPROFILE}\\scoop\\apps\\mpv\\current\\mpv.exe`)) return true;
                }

                if (program === 'aria2') {
                    if (require('fs').existsSync('C:\\ProgramData\\chocolatey\\bin\\aria2c.exe')) return true;
                    if (require('fs').existsSync(`${process.env.USERPROFILE}\\scoop\\apps\\aria2\\current\\aria2c.exe`)) return true;
                }

                if (program === 'yt-dlp') {
                    if (require('fs').existsSync('C:\\ProgramData\\chocolatey\\bin\\yt-dlp.exe')) return true;
                    if (require('fs').existsSync(`${process.env.USERPROFILE}\\scoop\\apps\\yt-dlp\\current\\yt-dlp.exe`)) return true;
                    if (require('fs').existsSync(`${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe\\yt-dlp.exe`)) return true;
                }

                return false;
            }
        } else {
            execSync(`which ${command}`, { stdio: "ignore" });
        }
        return true;
    } catch {
        return false;
    }
}

/**
 * @param {string} program
 * @returns {boolean}
 */
export function installPackage(program) {
    const osType = getOS();
    const pkg = PACKAGES[program];

    if (!pkg) {
        console.log(chalk.red(t("errors.packageNotFound", { name: program })));
        return false;
    }

    try {
        if (osType === "windows") {
            if (!checkCommand("winget")) {
                console.log(chalk.red(t("errors.wingetNotFound")));
                return false;
            }
            spawnSync("winget", ["install", "-e", "--id", pkg.win], { stdio: "inherit" });
            return true;

        } else if (osType === "macos") {
            if (!checkCommand("brew")) {
                console.log(chalk.red(t("errors.brewNotFound")));
                return false;
            }
            const args = ["install", ...pkg.mac.split(" ")];
            spawnSync("brew", args, { stdio: "inherit" });
            return true;

        } else if (osType === "linux") {
            if (checkCommand("apt")) {
                spawnSync("sudo", ["apt", "update"], { stdio: "inherit" });
                spawnSync("sudo", ["apt", "install", "-y", pkg.linux], { stdio: "inherit" });
                return true;
            } else if (checkCommand("pacman")) {
                spawnSync("sudo", ["pacman", "-S", "--noconfirm", pkg.linux], { stdio: "inherit" });
                return true;
            } else {
                console.log(chalk.red(t("errors.packageManagerNotFound")));
                return false;
            }
        }
    } catch (error) {
        console.error(chalk.red(t("errors.installError", { message: error.message })));
        return false;
    }
    return false;
}

/**
 * @param {string} cmd
 */
function checkCommand(cmd) {
    const osType = getOS();
    try {
        if (osType === "windows") {
            execSync(`where ${cmd}`, { stdio: "ignore" });
        } else {
            execSync(`which ${cmd}`, { stdio: "ignore" });
        }
        return true;
    } catch {
        return false;
    }
}
