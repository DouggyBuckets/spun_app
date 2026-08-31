import { db } from "../../db";
import { getAlbum, getArtist } from "./spotify";
import { notFound } from "../../errors";

function normalizeReleaseDate(releaseDate: string, precision: string): string {
    if (precision === "year") return `${releaseDate}-01-01`;
    if (precision === "month") return `${releaseDate}-01`;
    return releaseDate;
}

export async function getOrCreateArtist(spotifyId: string, name: string) {
    const result = await db.query<{ id: number }>(
        `SELECT id FROM artists WHERE external_id = $1`, [spotifyId]
    );
    if (result.rows[0]) return result.rows[0].id;

    const insertResult = await db.query<{ id: number }>(
        `INSERT into artists (external_id, name) VALUES ($1, $2)
        RETURNING id`, [spotifyId, name]
    );
    return insertResult.rows[0]!.id;
}

export async function getOrCreateAlbum(spotifyId: string) {
    const result = await db.query<{ id: number }>(
        `SELECT id FROM albums WHERE external_id = $1`, [spotifyId]
    );
    if (result.rows[0]) return result.rows[0].id;

    const albumDetails = await getAlbum(spotifyId);

    const artistIds: number[] = [];
    for (const artist of albumDetails.artists) {
        const artistId = await getOrCreateArtist(artist.id, artist.name);
        artistIds.push(artistId);
    }

    const albumResult = await db.query<{ id: number }>(
        `INSERT INTO albums (external_id, title, cover_url, release_date, album_type)
        VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [albumDetails.id, albumDetails.name, albumDetails.images[0]?.url ?? null,
            normalizeReleaseDate(albumDetails.release_date, albumDetails.release_date_precision),
            albumDetails.album_type]
    );
    const albumId = albumResult.rows[0]!.id;

    for (const artistId of artistIds) {
        await db.query(
            `INSERT INTO album_artists (album_id, artist_id) VALUES ($1, $2)`,
            [albumId, artistId]
        )
    }

    for (const track of albumDetails.tracks.items) {
        const songResult = await db.query<{ id: number }>(
            `INSERT INTO songs (external_id, title, track_number, duration_ms, album_id)
            VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [track.id, track.name, track.track_number, track.duration_ms, albumId]
        );
        const songId = songResult.rows[0]!.id;

        for (const artist of track.artists) {
            const artistId = await getOrCreateArtist(artist.id, artist.name);
            await db.query(
                `INSERT INTO song_artists (song_id, artist_id) VALUES ($1, $2)`,
                [songId, artistId]
            );
        }
    }

    return albumId;
}

export async function getOrCreateSongByTrackId(spotifyTrackId: string, albumSpotifyId: string) {
    await getOrCreateAlbum(albumSpotifyId); // Ensure album and its songs are created

    const result = await db.query<{ id: number }>(
        `SELECT id FROM songs WHERE external_id = $1`, [spotifyTrackId]
    );
    if (result.rows[0]) return result.rows[0].id;
    throw notFound("Song not found");
}

export async function getAlbumIdBySpotifyId(spotifyId: string) {
    const result = await db.query<{ id: number }>(
        `SELECT id FROM albums WHERE external_id = $1`, [spotifyId]
    );
    return result.rows[0]?.id;
}

export async function getSongIdBySpotifyId(spotifyId: string) {
    const result = await db.query<{ id: number }>(
        `SELECT id FROM songs WHERE external_id = $1`, [spotifyId]
    );
    return result.rows[0]?.id;
}

export async function getArtistIdBySpotifyId(spotifyId: string) {
    const result = await db.query<{ id: number }>(
        `SELECT id FROM artists WHERE external_id = $1`, [spotifyId]
    );
    return result.rows[0]?.id;
}

export async function getOrCreateArtistBySpotifyId(spotifyId: string) {
    const result = await db.query<{ id: number }>(
        `SELECT id FROM artists WHERE external_id = $1`, [spotifyId]
    );
    if (result.rows[0]) return result.rows[0].id;

    const artistDetails = await getArtist(spotifyId);
    const insertResult = await db.query<{ id: number }>(
        `INSERT into artists (external_id, name) VALUES ($1, $2)
        RETURNING id`, [artistDetails.id, artistDetails.name]
    );
    return insertResult.rows[0]!.id;
}