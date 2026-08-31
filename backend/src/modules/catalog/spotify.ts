import { config } from "../../config";
import { notFound } from "../../errors";

interface CachedToken {
    token: string;
    expiresAt: number; //timestamp (ms) when this token stops being valid
}

interface SpotifyTokenResponse {
    access_token: string;
    expires_in: number; //seconds until token expires
}

let cachedToken: CachedToken | null = null;

export async function getSpotifyToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
        return cachedToken.token
    }

    const credentials = Buffer.from(`${config.spotifyClientId}:${config.spotifyClientSecret}`).toString("base64");
    const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${credentials}`
        },
        body: "grant_type=client_credentials"
    });

    const data = await response.json() as SpotifyTokenResponse;
    cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in * 1000) //expires_in converted to millliseconds from seconds
    }

    return cachedToken.token;
}

interface SpotifyAlbumResponse {
    albums: {
        items: {
            id: string;
            name: string;
            images: { url: string }[];
            artists: { id: string; name: string }[];
        }[];
    };
}

export async function searchAlbums(query: string) {
    const token = await getSpotifyToken();
    const params = new URLSearchParams({q: query, type: "album", limit: "10"});
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });
    return await response.json() as SpotifyAlbumResponse;
}

interface SpotifyTrackSearchResponse {
    tracks: {
        items: {
            id: string;
            name: string;
            duration_ms: number;
            artists: { id: string; name: string }[];
            album: {
                id: string;
                name: string;
                images: { url: string }[];
            };
        }[];
    };
}

export async function searchTracks(query: string) {
    const token = await getSpotifyToken();
    const params = new URLSearchParams({ q: query, type: "track", limit: "10" });
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });
    return await response.json() as SpotifyTrackSearchResponse;
}

interface SpotifyArtistSearchResponse {
    artists: {
        items: {
            id: string;
            name: string;
            images: { url: string }[];
        }[];
    };
}

export async function searchArtists(query: string) {
    const token = await getSpotifyToken();
    const params = new URLSearchParams({ q: query, type: "artist", limit: "10" });
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });
    return await response.json() as SpotifyArtistSearchResponse;
}

interface SpotifyArtistAlbumsResponse {
    items: {
        id: string;
        name: string;
        images: { url: string }[];
        release_date: string;
        album_type: string;
    }[];
}

export async function getArtistAlbums(spotifyArtistId: string) {
    const token = await getSpotifyToken();
    const response = await fetch(`https://api.spotify.com/v1/artists/${spotifyArtistId}/albums`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    if (!response.ok) throw notFound("Artist not found");
    return await response.json() as SpotifyArtistAlbumsResponse;
}

interface SpotifyAlbumDetails {
    id: string;
    name: string;
    artists: {id : string, name: string}[];
    images: {url: string}[];
    release_date: string;
    release_date_precision: string;
    total_tracks: number;
    album_type: string;
    tracks: {
        items: {
            id: string;
            name: string;
            track_number: number;
            duration_ms: number;
            artists: { id: string; name: string }[];
            external_urls: { spotify: string };
        }[];
    };
}

export async function getAlbum(spotifyId: string) {
    const token = await getSpotifyToken();
    const response = await fetch(`https://api.spotify.com/v1/albums/${spotifyId}`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    if (!response.ok) throw notFound("Album not found");
    return await response.json() as SpotifyAlbumDetails;
}

export async function getArtist(spotifyId: string) {
    const token = await getSpotifyToken();
    const response = await fetch(`https://api.spotify.com/v1/artists/${spotifyId}`, {
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    if (!response.ok) throw notFound("Artist not found");
    return await response.json() as { id: string; name: string; images: { url: string }[] };
}