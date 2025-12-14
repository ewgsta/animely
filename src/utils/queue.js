// @ts-check
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

const queuePath = path.join(process.cwd(), "queue.animely");

/**
 * @typedef {Object} QueueItem
 * @property {string} animeName
 * @property {import("../jsdoc.js").DownloadEpisode} episode
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
	if (os.platform() === "win32" && fs.existsSync(queuePath)) {
		try {
			execSync(`attrib -h "${queuePath}"`);
		} catch (error) {
			// ignore
		}
	}

	fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2), "utf-8");

	if (os.platform() === "win32") {
		try {
			execSync(`attrib +h "${queuePath}"`);
		} catch (error) {
			// ignore
		}
	}
}
