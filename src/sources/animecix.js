// @ts-check
import axios from "axios";

const BASE_URL = "https://animecix.tv/";
const MANGACIX_URL = "https://mangacix.net";
const VIDEO_PLAYER = "tau-video.xyz";

const HEADERS = {
	"Accept": "application/json",
	"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
};

/**
 * Animecix.tv kaynağı - API üzerinden arama yapar
 */
export class AnimecixSource {
	constructor() {
		this.name = "Animecix";
		this.id = "animecix";
		this.supportsLocalSearch = false;
	}

	/**
	 * @param {string} url
	 * @returns {Promise<any>}
	 */
	async _getJson(url) {
		try {
			const response = await axios.get(url, { headers: HEADERS, timeout: 10000 });
			return response.data;
		} catch (e) {
			return null;
		}
	}

	/**
	 * Anime arama (API üzerinden)
	 * @param {string} query
	 * @returns {Promise<import("./index.js").SearchResult[]>}
	 */
	async search(query) {
		const url = `${BASE_URL}secure/search/${encodeURIComponent(query)}?type=&limit=20`;
		const data = await this._getJson(url);

		if (!data || !data.results) return [];

		return data.results.map(item => ({
			id: String(item.id),
			name: item.name,
			poster: item.poster,
			type: item.title_type || item.type,
			_isMovie: item.title_type === "movie" || item.type === "movie",
			_originalTitle: item.original_title
		}));
	}

	/**
	 * Sezon listesi
	 * @param {string} animeId
	 * @returns {Promise<number[]>}
	 */
	async _getSeasons(animeId) {
		const url = `${MANGACIX_URL}/secure/related-videos?episode=1&season=1&titleId=${animeId}&videoId=637113`;
		const data = await this._getJson(url);

		if (!data || !data.videos || !data.videos[0]) return [];

		const seasons = data.videos[0]?.title?.seasons;
		if (Array.isArray(seasons)) {
			return seasons.map((_, i) => i);
		}
		return [];
	}

	/**
	 * Bölüm listesi
	 * @param {string} animeId
	 * @returns {Promise<import("./index.js").Episode[]>}
	 */
	async getEpisodes(animeId) {
		const seasons = await this._getSeasons(animeId);
		
		// Eğer sezon bulunamazsa, tek sezon varsay
		const seasonList = seasons.length > 0 ? seasons : [0];
		
		const episodes = [];
		const seenNames = new Set();

		for (const seasonIndex of seasonList) {
			const url = `${MANGACIX_URL}/secure/related-videos?episode=1&season=${seasonIndex + 1}&titleId=${animeId}&videoId=637113`;
			const data = await this._getJson(url);

			if (!data || !data.videos) continue;

			for (const item of data.videos) {
				const name = item.name || "Bilinmeyen";
				if (seenNames.has(name)) continue;

				seenNames.add(name);
				episodes.push({
					id: `${animeId}_${seasonIndex + 1}_${episodes.length + 1}`,
					episode_number: episodes.length + 1,
					name: name,
					season: item.season_num || seasonIndex + 1,
					_url: item.url // Bu URL'i izleme için kullanacağız
				});
			}
		}

		return episodes;
	}

	/**
	 * Episode URL'den stream linklerini çıkar (Python'daki fetch_anime_watch_api_url)
	 * @param {string} episodeUrl - Episode URL (örn: "izle/anime-adi/bolum-1")
	 * @returns {Promise<import("./index.js").StreamLink[]>}
	 */
	async _getStreamLinksFromUrl(episodeUrl) {
		try {
			// URL'i tam hale getir
			const fullUrl = episodeUrl.startsWith("http") ? episodeUrl : `${BASE_URL}${episodeUrl}`;
			
			// Redirect'i takip et
			const response = await axios.get(fullUrl, {
				headers: HEADERS,
				maxRedirects: 10,
				timeout: 15000,
				validateStatus: () => true
			});

			// Final URL'i al
			const finalUrl = response.request?.res?.responseUrl || response.request?.responseURL || fullUrl;
			
			// URL'den embed_id ve vid'i çıkar
			const urlObj = new URL(finalUrl);
			const pathParts = urlObj.pathname.split("/").filter(p => p);
			
			// Path: /e/EMBED_ID veya /embed/EMBED_ID gibi olabilir
			let embedId = null;
			for (let i = 0; i < pathParts.length; i++) {
				if (pathParts[i] === "e" || pathParts[i] === "embed") {
					embedId = pathParts[i + 1];
					break;
				}
			}
			
			// Eğer bulunamazsa, path'in son kısmını dene
			if (!embedId && pathParts.length >= 2) {
				embedId = pathParts[pathParts.length - 1];
			}

			if (!embedId) {
				console.log("Embed ID bulunamadı:", finalUrl);
				return [];
			}

			const vid = urlObj.searchParams.get("vid");

			// Video API'sine istek at
			const apiUrl = `https://${VIDEO_PLAYER}/api/video/${embedId}${vid ? `?vid=${vid}` : ""}`;
			
			const apiResponse = await axios.get(apiUrl, { 
				timeout: 10000,
				headers: {
					"User-Agent": HEADERS["User-Agent"],
					"Referer": finalUrl
				}
			});
			
			const urls = apiResponse.data?.urls || [];

			return urls.map(item => ({
				url: item.url,
				quality: item.label || "default",
				label: item.label
			}));
		} catch (e) {
			console.error("Stream link hatası:", e.message);
			return [];
		}
	}

	/**
	 * Film için izleme linki
	 * @param {string} titleId
	 * @returns {Promise<import("./index.js").StreamLink[]>}
	 */
	async _getMovieStreamLinks(titleId) {
		const url = `${BASE_URL}secure/titles/${titleId}?titleId=${titleId}`;
		const headers = { ...HEADERS, "x-e-h": "=.a" };

		try {
			const response = await axios.get(url, { headers, timeout: 10000 });
			const data = response.data;
			const videos = data?.title?.videos || [];

			for (const video of videos) {
				const videoUrl = video.url;
				if (!videoUrl) continue;

				const streamLinks = await this._getStreamLinksFromUrl(videoUrl);
				if (streamLinks.length > 0) return streamLinks;
			}
		} catch (e) {
			console.error("Film stream hatası:", e.message);
		}

		return [];
	}

	/**
	 * İzleme linkleri
	 * @param {any} episodeData
	 * @returns {Promise<import("./index.js").StreamLink[]>}
	 */
	async getStreamLinks(episodeData) {
		// Film ise
		if (episodeData._isMovie) {
			return this._getMovieStreamLinks(episodeData._animeId);
		}

		// Dizi bölümü - _url'i kullan
		const videoUrl = episodeData._url;
		if (!videoUrl) {
			console.log("Episode URL bulunamadı:", episodeData);
			return [];
		}

		return this._getStreamLinksFromUrl(videoUrl);
	}
}
