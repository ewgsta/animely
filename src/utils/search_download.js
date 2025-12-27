// @ts-check
import { handleAnimecix } from "../sources/handlers/animecix.js";
import { handleAnimely } from "../sources/handlers/animely.js";

/**
 * Kaynak bazlı arama ve indirme router'ı
 * @param {import("../jsdoc.js").Anime[]|null} animes 
 * @param {import("./storage/queue.js").QueueItem[]} downloadQueue
 * @param {import("../sources/index.js").Source} source
 */
export async function searchAndDownload(animes, downloadQueue, source) {
    if (source.id === "animecix") {
        return handleAnimecix(downloadQueue, source);
    }

    return handleAnimely(animes, downloadQueue);
}
