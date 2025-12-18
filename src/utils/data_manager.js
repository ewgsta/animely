import axios from "axios";
import { API_URL } from "../constants.js";
import { getCachedAnimeList, saveAnimeListToCache } from "./cache.js";

/**
 * Anime listesini getirir. Önce cache kontrol eder, süresi dolmuşsa veya yoksa API'den çeker.
 * @param {boolean} forceUpdate - Cache süresini yoksayıp zorla güncellemek için true
 * @returns {Promise<import("../jsdoc.js").Anime[]>}
 */
export async function getAnimeList(forceUpdate = false) {
    if (!forceUpdate) {
        const cached = getCachedAnimeList();
        if (cached) {
            return cached;
        }
    }

    try {
        const response = await axios.get(`${API_URL}/animes`);
        const animes = response.data;

        saveAnimeListToCache(animes);

        return animes;
    } catch (error) {
        throw error;
    }
}
