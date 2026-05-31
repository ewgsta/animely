import axios from "axios";
import { setSpeed } from "../constants.js";

export async function runSpeedTest() {
    try {
        const start = Date.now();
        const response = await axios.get("https://speed.cloudflare.com/__down?bytes=1000000", {
            responseType: "arraybuffer",
            timeout: 5000
        });
        const end = Date.now();

        const durationSeconds = (end - start) / 1000;
        const sizeBits = response.data.length * 8;
        const speedBps = sizeBits / durationSeconds;
        const speedMbps = speedBps / (1024 * 1024);

        const roundedSpeed = Math.round(speedMbps);

        if (roundedSpeed > 0 && isFinite(roundedSpeed)) {
            setSpeed(roundedSpeed);
            return roundedSpeed;
        } else {
            return null;
        }

    } catch (error) {
        return null;
    }
}
