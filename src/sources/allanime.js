// @ts-check
import axios from "axios";

const ALLANIME_API = "https://api.allanime.day";
const ALLANIME_REFR = "https://allmanga.to";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0";

function decodeProviderUrl(encoded) {
    const hexMap = {
        "79": "A", "7a": "B", "7b": "C", "7c": "D", "7d": "E", "7e": "F", "7f": "G",
        "70": "H", "71": "I", "72": "J", "73": "K", "74": "L", "75": "M", "76": "N", "77": "O",
        "68": "P", "69": "Q", "6a": "R", "6b": "S", "6c": "T", "6d": "U", "6e": "V", "6f": "W",
        "60": "X", "61": "Y", "62": "Z",
        "59": "a", "5a": "b", "5b": "c", "5c": "d", "5d": "e", "5e": "f", "5f": "g",
        "50": "h", "51": "i", "52": "j", "53": "k", "54": "l", "55": "m", "56": "n", "57": "o",
        "48": "p", "49": "q", "4a": "r", "4b": "s", "4c": "t", "4d": "u", "4e": "v", "4f": "w",
        "40": "x", "41": "y", "42": "z",
        "08": "0", "09": "1", "0a": "2", "0b": "3", "0c": "4", "0d": "5", "0e": "6", "0f": "7",
        "00": "8", "01": "9",
        "15": "-", "16": ".", "67": "_", "46": "~", "02": ":", "17": "/", "07": "?",
        "1b": "#", "63": "[", "65": "]", "78": "@", "19": "!", "1c": "$", "1e": "&",
        "10": "(", "11": ")", "12": "*", "13": "+", "14": ",", "03": ";", "05": "=", "1d": "%"
    };

    let result = "";
    for (let i = 0; i < encoded.length; i += 2) {
        const hex = encoded.substring(i, i + 2).toLowerCase();
        result += hexMap[hex] || "";
    }
    return result.replace("/clock", "/clock.json");
}

export class AllAnimeSource {
    constructor() {
        this.name = "AllAnime";
        this.id = "allanime";
        this.language = "en";
        this.supportsLocalSearch = false;
        this.mode = "sub";
    }

    async _gqlRequest(params) {
        try {
            const response = await axios.get(`${ALLANIME_API}/api`, {
                params,
                headers: {
                    "User-Agent": USER_AGENT,
                    "Referer": ALLANIME_REFR
                },
                timeout: 15000
            });
            return response.data;
        } catch (e) {
            return null;
        }
    }

    async search(query) {
        const searchGql = `query($search: SearchInput $limit: Int $page: Int $translationType: VaildTranslationTypeEnumType $countryOrigin: VaildCountryOriginEnumType) {
            shows(search: $search limit: $limit page: $page translationType: $translationType countryOrigin: $countryOrigin) {
                edges { _id name availableEpisodes __typename }
            }
        }`;

        const variables = JSON.stringify({
            search: { allowAdult: false, allowUnknown: false, query },
            limit: 40,
            page: 1,
            translationType: this.mode,
            countryOrigin: "ALL"
        });

        const data = await this._gqlRequest({ variables, query: searchGql });
        if (!data?.data?.shows?.edges) return [];

        return data.data.shows.edges
            .filter(show => show.availableEpisodes?.[this.mode] > 0)
            .map(show => ({
                id: show._id,
                name: show.name,
                totalEpisodes: show.availableEpisodes?.[this.mode] || 0,
                _mode: this.mode
            }));
    }

    async getEpisodes(showId) {
        const episodesGql = `query($showId: String!) {
            show(_id: $showId) { _id availableEpisodesDetail }
        }`;

        const variables = JSON.stringify({ showId });
        const data = await this._gqlRequest({ variables, query: episodesGql });

        const episodeList = data?.data?.show?.availableEpisodesDetail?.[this.mode];
        if (!episodeList || !Array.isArray(episodeList)) return [];

        const sorted = [...episodeList].sort((a, b) => parseFloat(a) - parseFloat(b));

        return sorted.map((epNum, idx) => ({
            id: `${showId}_${epNum}`,
            episode_number: parseFloat(epNum) || idx + 1,
            name: `Episode ${epNum}`,
            _showId: showId,
            _epString: epNum
        }));
    }

    async _getLinksFromProvider(providerId) {
        try {
            const response = await axios.get(`https://allanime.day${providerId}`, {
                headers: {
                    "User-Agent": USER_AGENT,
                    "Referer": ALLANIME_REFR
                },
                timeout: 10000
            });

            const data = response.data;
            const links = [];

            if (data.links) {
                for (const link of data.links) {
                    if (link.hls && link.link) {
                        links.push({ quality: link.resolutionStr || "auto", url: link.link, _type: "hls" });
                    } else if (link.mp4 && link.link) {
                        links.push({ quality: link.resolutionStr || "auto", url: link.link, _type: "mp4" });
                    } else if (link.link) {
                        links.push({ quality: link.resolutionStr || "auto", url: link.link });
                    }
                }
            }

            return links;
        } catch (e) {
            return [];
        }
    }

    async getStreamLinks(episodeData) {
        const showId = episodeData._showId;
        const epString = episodeData._epString;

        if (!showId || !epString) return [];

        const episodeGql = `query($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
            episode(showId: $showId translationType: $translationType episodeString: $episodeString) {
                episodeString sourceUrls
            }
        }`;

        const variables = JSON.stringify({
            showId,
            translationType: this.mode,
            episodeString: epString
        });

        const data = await this._gqlRequest({ variables, query: episodeGql });

        const sourceUrls = data?.data?.episode?.sourceUrls;
        if (!sourceUrls || !Array.isArray(sourceUrls)) return [];

        const providers = [];
        for (const source of sourceUrls) {
            if (source.sourceUrl && source.sourceName) {
                const encodedUrl = source.sourceUrl.replace("--", "");
                const decodedUrl = decodeProviderUrl(encodedUrl);
                providers.push({ name: source.sourceName, url: decodedUrl });
            }
        }

        const preferredOrder = ["Luf-Mp4", "Default", "S-mp4", "Yt-mp4"];
        const sortedProviders = providers.sort((a, b) => {
            const aIdx = preferredOrder.indexOf(a.name);
            const bIdx = preferredOrder.indexOf(b.name);
            return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
        });

        for (const provider of sortedProviders) {
            const links = await this._getLinksFromProvider(provider.url);
            if (links.length > 0) {
                return links.map(l => ({
                    url: l.url,
                    quality: l.quality,
                    label: `${l.quality} (${provider.name})`
                }));
            }
        }

        return [];
    }

    setMode(mode) {
        this.mode = mode;
    }
}
