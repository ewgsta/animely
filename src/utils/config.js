// @ts-check
import fs from "fs";
import path from "path";
import os from "os";

const homeDir = os.homedir();
const configDir = path.join(homeDir, ".animely");
const configPath = path.join(configDir, "config.json");

if (!fs.existsSync(configDir)) {
	fs.mkdirSync(configDir, { recursive: true });
}

const defaultConfig = {
	maxConcurrent: 3,
	downloadDir: path.join(process.cwd(), "animely-downloads"),
	defaultPlayer: "", // "vlc" | "mpv"
	retryCount: 3,
	retryDelay: 3000,
	useAria2: false,
	aria2Connections: 16,
	retryEnabled: true,
	telemetryId: "",
	telemetryEnabled: null,
	showAnimeDetails: true
};

/**
 * @typedef {Object} Config
 * @property {number} maxConcurrent
 * @property {string} downloadDir
 * @property {string} defaultPlayer
 * @property {number} retryCount
 * @property {number} retryDelay
 * @property {boolean} useAria2
 * @property {number} aria2Connections
 * @property {boolean} retryEnabled
 * @property {string} [anilistToken]
 * @property {string} [anilistUsername]
 * @property {string} [telemetryId]
 * @property {boolean} [telemetryEnabled]
 * @property {boolean} [showAnimeDetails]
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
