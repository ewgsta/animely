// @ts-check
import axios from "axios";
import chalk from "chalk";
import http from "http";
import { exec } from "child_process";
import { getConfig } from "./config.js";
import { ANILIST_ID, AUTH_URL } from "../constants.js";

const ANILIST_API = "https://graphql.anilist.co";

/**
 * @param {string} token 
 * @returns {Promise<string|null>} Username if valid, null otherwise
 */
export async function verifyToken(token) {
	const query = `
	query {
		Viewer {
			name
			id
		}
	}
	`;

	try {
		const response = await axios.post(ANILIST_API, { query }, {
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			}
		});
		return response.data.data.Viewer.name;
	} catch (error) {
		return null;
	}
}

/**
 * @param {string} search 
 * @returns {Promise<number|null>} Media ID
 */
export async function searchAnime(search) {
	const query = `
	query ($search: String) {
		Media (search: $search, type: ANIME) {
			id
			title {
				romaji
				english
			}
		}
	}
	`;

	try {
		const response = await axios.post(ANILIST_API, {
			query,
			variables: { search }
		});
		return response.data.data.Media.id;
	} catch (error) {
		return null;
	}
}

/**
 * @param {number} mediaId 
 * @param {number} progress 
 * @param {boolean} completed 
 * @returns {Promise<boolean>}
 */
export async function updateAnilistProgress(mediaId, progress, completed) {
	const config = getConfig();
	// @ts-ignore
	if (!config.anilistToken) return false;

	const query = `
	mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
		SaveMediaListEntry (mediaId: $mediaId, progress: $progress, status: $status) {
			id
			status
			progress
		}
	}
	`;

	const variables = {
		mediaId,
		progress,
		status: completed ? "COMPLETED" : "CURRENT"
	};

	try {
		await axios.post(ANILIST_API, {
			query,
			variables
		}, {
			headers: {
				// @ts-ignore
				Authorization: `Bearer ${config.anilistToken}`,
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			}
		});
		return true;
	} catch (error) {
		console.error(chalk.red("Anilist güncelleme hatası:"), error.response?.data || error.message);
		return false;
	}
}

/**
 * Opens a local server to capture the AniList token
 * @returns {Promise<string>} The access token
 */
export function authenticate() {
	return new Promise((resolve, reject) => {
		const server = http.createServer((req, res) => {
			const url = new URL(req.url || "/", "http://localhost:6677");

			if (url.pathname === "/callback") {
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(`
					<html>
						<body style="background: #1a1a1a; color: #fff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh;">
							<div id="msg">Giriş yapılıyor...</div>
							<script>
								const hash = window.location.hash.substring(1);
								const params = new URLSearchParams(hash);
								const token = params.get('access_token');
								if (token) {
									fetch('/token', {
										method: 'POST',
										body: JSON.stringify({ token }),
										headers: { 'Content-Type': 'application/json' }
									}).then(() => {
										document.getElementById('msg').innerText = 'Giriş başarılı! Bu pencereyi kapatabilirsiniz.';
										window.close();
									});
								} else {
									document.getElementById('msg').innerText = 'Token bulunamadı. Lütfen tekrar deneyin.';
								}
							</script>
						</body>
					</html>
				`);
				return;
			}

			if (url.pathname === "/token" && req.method === "POST") {
				let body = "";
				req.on("data", chunk => body += chunk);
				req.on("end", () => {
					try {
						const { token } = JSON.parse(body);
						res.writeHead(200);
						res.end();
						server.close();
						resolve(token);
					} catch (e) {
						res.writeHead(400);
						res.end();
						reject(e);
					}
				});
				return;
			}

			res.writeHead(404);
			res.end();
		});

		server.listen(6677, () => {
			const authUrl = AUTH_URL;
			console.log(chalk.cyan("\nTarayıcı açılıyor... Lütfen AniList hesabınızla giriş yapın."));
			console.log(chalk.gray(`Eğer açılmazsa bu linke tıklayın: ${authUrl}`));

			const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
			if (process.platform === 'win32') {
				exec(`start "" "${authUrl}"`);
			} else {
				exec(`${start} "${authUrl}"`);
			}
		});

		server.on("error", (err) => {
			reject(err);
		});
	});
}

