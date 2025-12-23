// @ts-check
/**
 * @typedef {Object} Source
 * @property {string} name
 * @property {string} id
 * @property {boolean} supportsLocalSearch - Lokal fuzzy search destekliyor mu
 * @property {() => Promise<import("../jsdoc.js").Anime[]>} [getAnimeList] - Tüm anime listesi (lokal search için)
 * @property {(query: string) => Promise<SearchResult[]>} search - Anime arama
 * @property {(animeId: string) => Promise<Episode[]>} getEpisodes - Bölüm listesi
 * @property {(episodeData: any) => Promise<StreamLink[]>} getStreamLinks - İzleme linkleri
 */

/**
 * @typedef {Object} SearchResult
 * @property {string} id
 * @property {string} name
 * @property {string} [poster]
 * @property {string} [type]
 * @property {number} [totalEpisodes]
 * @property {string[]} [otherNames]
 */

/**
 * @typedef {Object} Episode
 * @property {string} id
 * @property {number|string} episode_number
 * @property {string} [name]
 * @property {number} [season]
 */

/**
 * @typedef {Object} StreamLink
 * @property {string} url
 * @property {string} [quality]
 * @property {string} [label]
 */

import { AnimelySource } from "./animely.js";
import { AnimecixSource } from "./animecix.js";

/** @type {Source[]} */
export const sources = [
	new AnimelySource(),
	new AnimecixSource()
];

/**
 * @param {string} id
 * @returns {Source|undefined}
 */
export function getSourceById(id) {
	return sources.find(s => s.id === id);
}

/**
 * @returns {Source}
 */
export function getDefaultSource() {
	return sources[0];
}
