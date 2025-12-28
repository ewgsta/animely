// @ts-check
import axios from "axios";
import { API_URL } from "../constants.js";
import { getCachedAnimeList, saveAnimeListToCache } from "../utils/storage/cache.js";

/**
 * Animely.net
 */
export class AnimelySource {
	constructor() {
		this.name = "Animely";
		this.id = "animely";
		this.language = "tr";
		this.supportsLocalSearch = true;
	}

	/**
	 * @returns {Promise<import("../jsdoc.js").Anime[]>}
	 */
	async getAnimeList() {
		const cached = getCachedAnimeList();
		if (cached) return cached;

		const response = await axios.get(`${API_URL}/animes`);
		const animes = response.data;
		saveAnimeListToCache(animes);
		return animes;
	}

	/**
	 * @param {string} query
	 * @returns {Promise<import("./index.js").SearchResult[]>}
	 */
	async search(query) {
		const animes = await this.getAnimeList();
		const lowerQuery = query.toLowerCase().trim();

		let results = animes.filter(({ NAME, OTHER_NAMES }) => {
			const lowerName = NAME.toLowerCase();
			const lowerOthers = OTHER_NAMES.map(n => n.toLowerCase());
			return lowerName === lowerQuery || lowerOthers.includes(lowerQuery);
		});

		if (results.length === 0) {
			results = animes.filter(({ NAME, OTHER_NAMES }) => {
				const lowerName = NAME.toLowerCase();
				const lowerOthers = OTHER_NAMES.map(n => n.toLowerCase());
				return lowerName.includes(lowerQuery) || lowerOthers.some(n => n.includes(lowerQuery));
			});
		}

		if (results.length === 0) {
			results = animes.filter(({ NAME, OTHER_NAMES }) => {
				const allNames = [NAME, ...OTHER_NAMES].map(n => n.toLowerCase());
				const words = lowerQuery.split(" ");
				return allNames.some(name => words.every(word => name.includes(word)));
			});
		}

		return results.map(anime => ({
			id: anime.SLUG,
			name: anime.NAME,
			poster: anime.FIRST_IMAGE,
			totalEpisodes: anime.TOTAL_EPISODES,
			otherNames: anime.OTHER_NAMES,
			_raw: anime
		}));
	}

	/**
	 * @param {string} animeSlug
	 * @returns {Promise<import("./index.js").Episode[]>}
	 */
	async getEpisodes(animeSlug) {
		const response = await axios.post(`${API_URL}/searchAnime`, { payload: animeSlug });
		const episodes = response.data.episodes || [];

		return episodes.map(ep => ({
			id: ep.id,
			episode_number: ep.episode_number,
			name: `${ep.episode_number}. Bölüm`,
			type: ep.type,
			fansub: ep.fansub,
			_links: [ep.backblaze_link, ep.watch_link_1, ep.watch_link_2, ep.watch_link_3]
		}));
	}

	/**
	 * @param {any} episodeData
	 * @returns {Promise<import("./index.js").StreamLink[]>}
	 */
	async getStreamLinks(episodeData) {
		const links = episodeData._links || [];
		const validLink = links.find(l => l && typeof l === "string" && l.trim() !== "");

		if (!validLink) return [];

		return [{ url: validLink, quality: "default" }];
	}
}
