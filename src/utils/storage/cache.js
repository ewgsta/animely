import fs from "fs";
import path from "path";
import os from "os";

const homeDir = os.homedir();
const configDir = path.join(homeDir, ".animely");
const cachePath = path.join(configDir, "anime_cache.json");
const CACHE_DURATION_MS = 30 * 60 * 1000;

export function getCachedAnimeList() {
    if (!fs.existsSync(cachePath)) return null;

    try {
        const raw = fs.readFileSync(cachePath, "utf-8");
        const cache = JSON.parse(raw);

        const now = Date.now();
        if (now - cache.timestamp > CACHE_DURATION_MS) {
            return null;
        }

        return cache.data;
    } catch (e) {
        return null;
    }
}

export function saveAnimeListToCache(data) {
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }

    const cache = {
        timestamp: Date.now(),
        data: data
    };

    try {
        fs.writeFileSync(cachePath, JSON.stringify(cache), "utf-8");
    } catch (e) {
    }
}
