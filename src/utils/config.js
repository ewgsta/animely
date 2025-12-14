// @ts-check
import fs from "fs";
import path from "path";
import os from "os";

const homeDir = os.homedir();
const configDir = path.join(homeDir, ".animely");
const configPath = path.join(configDir, "config.json");

// Ensure config directory exists
if (!fs.existsSync(configDir)) {
	fs.mkdirSync(configDir, { recursive: true });
}

const defaultConfig = {
	maxConcurrent: 3,
	downloadDir: path.join(process.cwd(), "animely-downloads"),
	defaultPlayer: "", // "vlc" | "mpv"
};

/**
 * @typedef {Object} Config
 * @property {number} maxConcurrent
 * @property {string} downloadDir
 * @property {string} defaultPlayer
 */

/**
 * @returns {Config}
 */
export function getConfig() {
	if (!fs.existsSync(configPath)) {
		saveConfig(defaultConfig);
		return defaultConfig;
	}

	try {
		const fileContent = fs.readFileSync(configPath, "utf-8");
		return { ...defaultConfig, ...JSON.parse(fileContent) };
	} catch (error) {
		return defaultConfig;
	}
}

/**
 * @param {Config} config 
 */
export function saveConfig(config) {
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}
