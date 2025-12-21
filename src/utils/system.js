// @ts-check
import { spawnSync, execSync } from "child_process";
import os from "os";
import chalk from "chalk";

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
            execSync(`where ${command}`, { stdio: "ignore" });
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
        console.log(chalk.red(`paket tanimi bulunamadi: ${program}`));
        return false;
    }

    try {
        if (osType === "windows") {
            // Winget
            if (!checkCommand("winget")) {
                console.log(chalk.red("winget bulunamadi."));
                return false;
            }
            spawnSync("winget", ["install", "-e", "--id", pkg.win], { stdio: "inherit" });
            return true;

        } else if (osType === "macos") {
            // Brew
            if (!checkCommand("brew")) {
                console.log(chalk.red("homebrew bulunamadi."));
                return false;
            }
            const args = ["install", ...pkg.mac.split(" ")];
            spawnSync("brew", args, { stdio: "inherit" });
            return true;

        } else if (osType === "linux") {
            // Apt / Pacman
            if (checkCommand("apt")) {
                spawnSync("sudo", ["apt", "update"], { stdio: "inherit" });
                spawnSync("sudo", ["apt", "install", "-y", pkg.linux], { stdio: "inherit" });
                return true;
            } else if (checkCommand("pacman")) {
                spawnSync("sudo", ["pacman", "-S", "--noconfirm", pkg.linux], { stdio: "inherit" });
                return true;
            } else {
                console.log(chalk.red("paket yoneticisi (apt/pacman) bulunamadi."));
                return false;
            }
        }
    } catch (error) {
        console.error(chalk.red(`kurulum hatasi: ${error.message}`));
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
