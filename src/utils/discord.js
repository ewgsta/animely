// @ts-check
import RPC from "discord-rpc";
import chalk from "chalk";

import { DISCORD_ID } from "../constants.js";

const clientId = DISCORD_ID;
let client;
let startTime = Date.now();
let isReady = false;

export async function initDiscordRpc() {
    try {
        client = new RPC.Client({ transport: "ipc" });

        client.on("ready", () => {
            isReady = true;
            setActivity("Menüde geziniyor");
        });

        await client.login({ clientId }).catch((err) => {
            // discordu arkada acık bırak lan
        });
    } catch (error) {
        // ha 
    }
}

/**
 * @param {string} details 
 * @param {string} [state] 
 */
export function setActivity(details, state) {
    if (!client || !isReady) return;

    try {
        client.setActivity({
            details: details,
            state: state,
            startTimestamp: startTime,
            largeImageKey: "logo",
            largeImageText: "Animely CLI",
            instance: false,
            buttons: [
                { label: "İndir", url: "https://github.com/ewgsta/animely" }
            ]
        }).catch((err) => {
            // hı hı evet burada da hata olursa
        });
    } catch (error) {
        // bugunde hata aldık amk
    }
}
