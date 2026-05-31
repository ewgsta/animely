/**
 * @typedef {{
 * _id: string;
 * NAME: string;
 * TOTAL_EPISODES: number;
 * FIRST_IMAGE: string;
 * CATEGORIES: string[];
 * DESCRIPTION: string;
 * SLUG: string;
 * SEASON_NUMBER: number;
 * OTHER_NAMES: string[];
 * }} Anime
 */

/**
 * @typedef {{
 * id: string;
 * episode_number: number;
 * backblaze_link: string;
 * watch_link_1: string;
 * watch_link_2: string;
 * watch_link_3: string;
 * type: string;
 * fansub: string;
 * }} Episode
 */

/**
 * @typedef {{
 * id: string;
 * episode_number: number|string;
 * link: string;
 * }} DownloadEpisode
 */

/**
 * @typedef {{
 * id: string;
 * name: string;
 * poster?: string;
 * type?: string;
 * totalEpisodes?: number;
 * otherNames?: string[];
 * _raw?: any;
 * _isMovie?: boolean;
 * }} SearchResult
 */

/**
 * @typedef {{
 * id: string;
 * episode_number: number|string;
 * name?: string;
 * season?: number;
 * type?: string;
 * fansub?: string;
 * _links?: string[];
 * _url?: string;
 * _animeId?: string;
 * }} SourceEpisode
 */

/**
 * @typedef {{
 * url: string;
 * quality?: string;
 * label?: string;
 * }} StreamLink
 */


export { };