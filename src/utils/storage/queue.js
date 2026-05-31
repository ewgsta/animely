// @ts-check
import fs from "fs";
import path from "path";
import os from "os";

const homeDir = os.homedir();
const configDir = path.join(homeDir, ".animely");
const queuePath = path.join(configDir, "queue.json");

if (!fs.existsSync(configDir)) {
	fs.mkdirSync(configDir, { recursive: true });
}

/**
 * @typedef {Object} QueueItem
 * @property {string} animeName
 * @property {import("../../jsdoc.js").DownloadEpisode} episode
 * @property {string} dirPath
 * @property {string} safeAnimeName
 */

/**
 * @returns {QueueItem[]}
 */
export function loadQueue() {
	if (!fs.existsSync(queuePath)) {
		return [];
	}

	try {
		const fileContent = fs.readFileSync(queuePath, "utf-8");
		return JSON.parse(fileContent);
	} catch (error) {
		return [];
	}
}

/**
 * @param {QueueItem[]} queue 
 */
export function saveQueue(queue) {
	fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2), "utf-8");
}
