// @ts-check
import { handleAnimecix } from "../sources/handlers/animecix.js";
import { handleAnimely } from "../sources/handlers/animely.js";
import { handleAllAnime } from "../sources/handlers/allanime.js";

/**
 * @param {import("../jsdoc.js").Anime[]|null} animes 
 * @param {import("./storage/queue.js").QueueItem[]} downloadQueue
 * @param {import("../sources/index.js").Source} source
 */
export async function searchAndDownload(animes, downloadQueue, source) {
    if (source.id === "animecix") {
        return handleAnimecix(downloadQueue, source);
    }

    if (source.id === "allanime") {
        return handleAllAnime(downloadQueue, source);
    }

    return handleAnimely(animes, downloadQueue);
}
