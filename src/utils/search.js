/**
 * Fuzzy search function for anime names
 * @param {string} searchTerm 
 * @param {import("../jsdoc.js").Anime[]} animes 
 * @returns {import("../jsdoc.js").Anime[]}
 */
export function searchAnimes(searchTerm, animes) {
    const lowerSearchTerm = searchTerm.toLowerCase().trim();

    const exactMatches = animes.filter(({ NAME, OTHER_NAMES }) => {
        const lowerName = NAME.toLowerCase();
        const lowerOthers = OTHER_NAMES.map(n => n.toLowerCase());
        return lowerName === lowerSearchTerm || lowerOthers.includes(lowerSearchTerm);
    });

    if (exactMatches.length > 0) {
        return exactMatches;
    }

    const partialMatches = animes.filter(({ NAME, OTHER_NAMES }) => {
        const lowerName = NAME.toLowerCase();
        const lowerOthers = OTHER_NAMES.map(n => n.toLowerCase());
        return lowerName.includes(lowerSearchTerm) ||
            lowerOthers.some(name => name.includes(lowerSearchTerm));
    });

    if (partialMatches.length > 0) {
        return partialMatches;
    }

    const fuzzyMatches = animes.filter(({ NAME, OTHER_NAMES }) => {
        const allNames = [NAME, ...OTHER_NAMES].map(n => n.toLowerCase());
        return allNames.some(name => {
            const words = lowerSearchTerm.split(" ");
            return words.every(word => name.includes(word));
        });
    });

    return fuzzyMatches;
}
