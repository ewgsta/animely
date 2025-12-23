// @ts-check
import fs from "fs";
import path from "path";
import os from "os";

const homeDir = os.homedir();
const historyDir = path.join(homeDir, ".animely");
const historyPath = path.join(historyDir, "history.json");

if (!fs.existsSync(historyDir)) {
	fs.mkdirSync(historyDir, { recursive: true });
}

/**
 * @typedef {Object} HistoryItem
 * @property {string} name
 * @property {number} lastEpisode
 * @property {number} totalEpisodes
 * @property {boolean} completed
 * @property {number} [anilistId]
 * @property {string} lastWatchedAt
 */

/**
 * @typedef {Object.<string, HistoryItem>} History
 */

/**
 * @returns {History}
 */
export function loadHistory() {
	if (!fs.existsSync(historyPath)) {
		return {};
	}
	try {
		return JSON.parse(fs.readFileSync(historyPath, "utf-8"));
	} catch (error) {
		return {};
	}
}

/**
 * @param {History} history 
 */
export function saveHistory(history) {
	fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

/**
 * @param {string} animeName 
 * @param {number} episodeNumber 
 * @param {number} totalEpisodes 
 * @param {number} [anilistId] 
 */
export function updateHistory(animeName, episodeNumber, totalEpisodes, anilistId) {
	const history = loadHistory();
	const isCompleted = episodeNumber >= totalEpisodes;

	history[animeName] = {
		name: animeName,
		lastEpisode: episodeNumber,
		totalEpisodes: totalEpisodes,
		completed: isCompleted,
		anilistId: anilistId || (history[animeName] ? history[animeName].anilistId : undefined),
		lastWatchedAt: new Date().toISOString()
	};

	saveHistory(history);
}
