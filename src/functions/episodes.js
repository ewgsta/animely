// @ts-check
import chalk from "chalk";

export function getLink(/** @type {string[]} */ links) {
	if (!Array.isArray(links)) {
		return "";
	}
	return links.find(link => link && typeof link === "string" && link.trim() !== "") || "";
}

export function formatName(/** @type {number|string|object} */ number, /** @type {string} */ type) {
	let episodeNumber;
	
	if (typeof number === "object" && number !== null) {
		console.warn("Episode number is an object:", number);
		episodeNumber = "?";
	} else if (typeof number === "string") {
		const parsed = parseInt(number, 10);
		episodeNumber = isNaN(parsed) ? "?" : parsed;
	} else if (typeof number === "number" && !isNaN(number)) {
		episodeNumber = number;
	} else {
		console.warn("Invalid episode number:", number);
		episodeNumber = "?";
	}
	
	const typeLabel = type && typeof type === "string" && type.length ? chalk.red(`(${type})`) : "";
	return `${episodeNumber}. Bölüm ${typeLabel}`;
}