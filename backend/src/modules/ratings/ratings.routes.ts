import { Router } from "express";
import { z } from "zod";
import { db } from "../../db";
import { requireAuth } from "../../middleware/auth";
import { getOrCreateAlbum, getOrCreateSongByTrackId, getAlbumIdBySpotifyId, getSongIdBySpotifyId } from "../catalog/catalogImport";
import { notFound } from "../../errors";

const router = Router();

const rateSchema = z.object({
    score: z.number().int().min(1).max(10),
});

async function getAggregateScore(entityType: "album" | "song", entityId: number) {
    const result = await db.query<{ average: string | null; count: string }>(
        `SELECT AVG(score)::numeric(10,2) AS average, COUNT(*) AS count
        FROM ratings WHERE entity_type = $1 AND entity_id = $2`,
        [entityType, entityId]
    );
    const row = result.rows[0]!;
    return {
        averageScore: row.average !== null ? Number(row.average) : null,
        ratingCount: Number(row.count),
    };
}

const popularAlbumsSchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(10),
});

router.get("/popular-albums", requireAuth, async (req, res) => {
    const { limit } = popularAlbumsSchema.parse(req.query);

    const result = await db.query<{
        spotify_id: string;
        title: string;
        cover_url: string | null;
        average: string;
        count: string;
    }>(
        `SELECT al.external_id AS spotify_id, al.title, al.cover_url,
            AVG(r.score)::numeric(10,2) AS average, COUNT(r.id)::int AS count
        FROM ratings r
        JOIN albums al ON al.id = r.entity_id AND r.entity_type = 'album'
        GROUP BY al.id
        ORDER BY count DESC, average DESC
        LIMIT $1`,
        [limit]
    );
    res.json(
        result.rows.map((row) => ({
            spotifyId: row.spotify_id,
            title: row.title,
            coverUrl: row.cover_url,
            averageScore: Number(row.average),
            ratingCount: Number(row.count),
        }))
    );
});

router.get("/albums/:spotifyId", requireAuth, async (req, res) => {
    const albumId = await getAlbumIdBySpotifyId(req.params.spotifyId as string);
    if (!albumId) {
        res.json({ score: null, averageScore: null, ratingCount: 0 });
        return;
    }

    const [result, aggregate] = await Promise.all([
        db.query<{ score: number }>(
            `SELECT score FROM ratings WHERE user_id = $1 AND entity_type = 'album' AND entity_id = $2`,
            [req.user!.id, albumId]
        ),
        getAggregateScore("album", albumId),
    ]);
    res.json({ score: result.rows[0]?.score ?? null, ...aggregate });
});

router.get("/songs/:spotifyId", requireAuth, async (req, res) => {
    const songId = await getSongIdBySpotifyId(req.params.spotifyId as string);
    if (!songId) {
        res.json({ score: null, averageScore: null, ratingCount: 0 });
        return;
    }

    const [result, aggregate] = await Promise.all([
        db.query<{ score: number }>(
            `SELECT score FROM ratings WHERE user_id = $1 AND entity_type = 'song' AND entity_id = $2`,
            [req.user!.id, songId]
        ),
        getAggregateScore("song", songId),
    ]);
    res.json({ score: result.rows[0]?.score ?? null, ...aggregate });
});

router.get("/albums/:spotifyId/tracks", requireAuth, async (req, res) => {
    const albumId = await getAlbumIdBySpotifyId(req.params.spotifyId as string);
    if (!albumId) {
        res.json([]);
        return;
    }

    const result = await db.query<{ spotify_id: string; average: string; count: string }>(
        `SELECT so.external_id AS spotify_id,
            AVG(r.score)::numeric(10,2) AS average, COUNT(r.id) AS count
        FROM songs so
        JOIN ratings r ON r.entity_type = 'song' AND r.entity_id = so.id
        WHERE so.album_id = $1
        GROUP BY so.external_id`,
        [albumId]
    );
    res.json(
        result.rows.map((row) => ({
            spotifyId: row.spotify_id,
            averageScore: Number(row.average),
            ratingCount: Number(row.count),
        }))
    );
});

router.post("/albums/:spotifyId", requireAuth, async (req, res) => {
    const { score } = rateSchema.parse(req.body);
    const albumId = await getOrCreateAlbum(req.params.spotifyId as string);

    const result = await db.query(
        `INSERT INTO ratings (user_id, entity_type, entity_id, score)
        VALUES ($1, 'album', $2, $3)
        ON CONFLICT (user_id, entity_type, entity_id)
        DO UPDATE SET score = $3, updated_at = now()
        RETURNING id, score`,
        [req.user!.id, albumId, score]
    );
    res.json(result.rows[0]);
});

const rateSongSchema = z.object({
    score: z.number().int().min(1).max(10),
    albumSpotifyId: z.string(),
});

router.post("/songs/:spotifyId", requireAuth, async (req, res) => {
    const { score, albumSpotifyId } = rateSongSchema.parse(req.body);
    const songId = await getOrCreateSongByTrackId(req.params.spotifyId as string, albumSpotifyId);

    const result = await db.query(
        `INSERT INTO ratings (user_id, entity_type, entity_id, score)
        VALUES ($1, 'song', $2, $3)
        ON CONFLICT (user_id, entity_type, entity_id)
        DO UPDATE SET score = $3, updated_at = now()
        RETURNING id, score`,
        [req.user!.id, songId, score]
    );
    res.json(result.rows[0]);
});

router.delete("/albums/:spotifyId", requireAuth, async (req, res) => {
    const albumId = await getAlbumIdBySpotifyId(req.params.spotifyId as string);
    if (!albumId) throw notFound("Album not found");

    await db.query(
        `DELETE FROM ratings WHERE user_id = $1 AND entity_type = 'album' AND entity_id = $2`,
        [req.user!.id, albumId]
    );
    res.json({ message: "Rating deleted successfully" });
});

router.delete("/songs/:spotifyId", requireAuth, async (req, res) => {
    const songId = await getSongIdBySpotifyId(req.params.spotifyId as string);
    if (!songId) throw notFound("Song not found");

    await db.query(
        `DELETE FROM ratings WHERE user_id = $1 AND entity_type = 'song' AND entity_id = $2`,
        [req.user!.id, songId]
    );
    res.json({ message: "Rating deleted successfully" });
});

export default router;