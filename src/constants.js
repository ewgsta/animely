export const API_URL = "https://animely.net/api";
export const ANILIST_ID = "33354";
export const DISCORD_ID = "1449760321764855858";
export const AUTH_URL = `https://anilist.co/api/v2/oauth/authorize?client_id=${ANILIST_ID}&response_type=token`;

export let EstSpeed = null;

export const setSpeed = (s) => {
    EstSpeed = s;
};
export const EP_SIZE = 250;