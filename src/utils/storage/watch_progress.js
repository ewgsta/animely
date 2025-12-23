// @ts-check
import fs from "fs";
import path from "path";
import os from "os";

const homeDir = os.homedir();
const configDir = path.join(homeDir, ".animely");
const progressPath = path.join(configDir, "watch_progress.json");

if (!fs.existsSync(configDir)) {
	fs.mkdirSync(configDir, { recursive: true });
}

/**
 * @typedef {Object} WatchProgressItem
 * @property {string} animeName
 * @property {number|string} episode
 * @property {number} position 
 * @property {number} duration 
 * @property {string} updatedAt
 */

/**
 * @typedef {Object.<string, WatchProgressItem>} WatchProgress
 */

/**
 * @param {string} animeName
 * @param {number|string} episode
 * @returns {string}
 */
function getKey(animeName, episode) {
	return `${animeName}::${episode}`;
}

/**
 * @returns {WatchProgress}
 */
export function loadWatchProgress() {
	if (!fs.existsSync(progressPath)) {
		return {};
	}
	try {
		return JSON.parse(fs.readFileSync(progressPath, "utf-8"));
	} catch (error) {
		return {};
	}
}

/**
 * @param {WatchProgress} progress
 */
export function saveWatchProgress(progress) {
	fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

/**
 * @param {string} animeName
 * @param {number|string} episode
 * @param {number} position
 * @param {number} duration
 */
export function updateWatchPosition(animeName, episode, position, duration) {
	const progress = loadWatchProgress();
	const key = getKey(animeName, episode);

	if (duration > 0 && position / duration > 0.9) {
		delete progress[key];
		saveWatchProgress(progress);
		return;
	}

	progress[key] = {
		animeName,
		episode,
		position,
		duration,
		updatedAt: new Date().toISOString()
	};

	saveWatchProgress(progress);
}

/**
 * @param {string} animeName
 * @param {number|string} episode
 * @returns {WatchProgressItem|null}
 */
export function getWatchPosition(animeName, episode) {
	const progress = loadWatchProgress();
	const key = getKey(animeName, episode);
	return progress[key] || null;
}

/**
 * @param {string} animeName
 * @param {number|string} episode
 */
export function clearWatchPosition(animeName, episode) {
	const progress = loadWatchProgress();
	const key = getKey(animeName, episode);
	delete progress[key];
	saveWatchProgress(progress);
}
