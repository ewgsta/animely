// @ts-check
import RPC from "discord-rpc";
import { DISCORD_ID, LOGO_URL } from "../constants.js";
import { t } from "../i18n/index.js";

const clientId = DISCORD_ID;
let client;
let startTime = Date.now();
let isReady = false;

export async function initDiscordRpc() {
	try {
		client = new RPC.Client({ transport: "ipc" });

		client.on("ready", () => {
			isReady = true;
			setActivity("Browsing menu");
		});

		await client.login({ clientId }).catch(() => {});
	} catch {
        
	}
}

/**
 * @param {string} details
 * @param {string} [state]
 */
export function setActivity(details, state) {
	if (!client || !isReady) return;

	try {
		client.request("SET_ACTIVITY", {
			pid: process.pid,
			activity: {
				details: details,
				state: state,
				timestamps: { start: startTime },
				assets: {
					large_image: LOGO_URL,
					large_text: "Animely CLI"
				},
				buttons: [{ label: t("discord.download"), url: "https://github.com/ewgsta/animely" }]
			}
		}).catch(() => {});
	} catch {
	}
}

/**
 * @param {object} options
 * @param {string} options.animeName 
 * @param {string} options.animeImage 
 * @param {number} options.episode 
 * @param {number} options.totalEpisodes 
 */
export function setWatchingActivity({ animeName, animeImage, episode, totalEpisodes }) {
	if (!client || !isReady) return;

	const isValidUrl = animeImage && animeImage.startsWith("https://");
	const largeImage = isValidUrl ? animeImage : LOGO_URL;

	try {
		const activity = {
			details: animeName,
			state: `(${episode}/${totalEpisodes})`,
			timestamps: {
				start: Date.now()
			},
			assets: {
				large_image: largeImage,
				large_text: animeName,
				small_image: LOGO_URL,
				small_text: "Animely"
			},
			buttons: [{ label: t("discord.download"), url: "https://github.com/ewgsta/animely" }]
		};

		client.request("SET_ACTIVITY", {
			pid: process.pid,
			activity: activity
		}).catch(() => {});
	} catch {
	}
}
