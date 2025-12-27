// @ts-check
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {Object.<string, any>} */
const translations = {
    tr: JSON.parse(fs.readFileSync(path.join(__dirname, "tr.json"), "utf-8")),
    en: JSON.parse(fs.readFileSync(path.join(__dirname, "en.json"), "utf-8"))
};

/** @type {string} */
let currentLanguage = "tr";

/**
 * @param {string} lang
 */
export function setLanguage(lang) {
    if (translations[lang]) {
        currentLanguage = lang;
    }
}

/**
 * @returns {string}
 */
export function getLanguage() {
    return currentLanguage;
}

/**
 * @returns {string[]}
 */
export function getAvailableLanguages() {
    return Object.keys(translations);
}

/**
 * @param {string} key - Dot notation key (e.g., "menu.searchAnime")
 * @param {Object.<string, string|number>} [params] - Parameters to replace in the string
 * @returns {string}
 */
export function t(key, params = {}) {
    const keys = key.split(".");
    let value = translations[currentLanguage];

    for (const k of keys) {
        if (value && typeof value === "object" && k in value) {
            value = value[k];
        } else {
            // Fallback to Turkish if key not found
            value = translations["tr"];
            for (const fallbackKey of keys) {
                if (value && typeof value === "object" && fallbackKey in value) {
                    value = value[fallbackKey];
                } else {
                    return key; // Return key if not found in fallback
                }
            }
            break;
        }
    }

    if (typeof value !== "string") {
        return key;
    }

    // Replace parameters
    let result = value;
    for (const [paramKey, paramValue] of Object.entries(params)) {
        result = result.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramValue));
    }

    return result;
}

export const i18n = { t, setLanguage, getLanguage, getAvailableLanguages };
