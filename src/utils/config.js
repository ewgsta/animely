// @ts-check
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import os from "os";

const configPath = path.join(process.cwd(), ".config.animely");

const defaultConfig = {
	maxConcurrent: 3,
	downloadDir: "videos"
};

/**
 * @typedef {Object} Config
 * @property {number} maxConcurrent
 * @property {string} downloadDir
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
	
	if (os.platform() === "win32") {
		try {
			execSync(`attrib +h "${configPath}"`);
		} catch (error) {
			// Olmazsa siktir et amına koyayım.
		}
	}
}
