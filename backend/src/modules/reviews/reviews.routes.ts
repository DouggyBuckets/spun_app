import { Router } from "express";
import { z } from "zod";
import { db } from "../../db";
import { notFound } from "../../errors";
import { requireAuth } from "../../middleware/auth";
import {
    getOrCreateAlbum,
    getOrCreateSongByTrackId,
    getAlbumIdBySpotifyId,
    getSongIdBySpotifyId,
} from "../catalog/catalogImport";

const router = Router();

async function findRatingId(userId: number, entityType: "album" | "song", entityId: number) {
    const result = await db.query<{ id: number }>(
        `SELECT id FROM ratings WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3`,
        [userId, entityType, entityId]
    );
    return result.rows[0]?.id ?? null;
}

const paginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});

router.get("/:username", async (req, res) => {
    const { limit, offset } = paginationSchema.parse(req.query);

    const userResult = await db.query<{ id: number }>(
        `SELECT id FROM users WHERE username = $1`, [req.params.username]
    );
    const user = userResult.rows[0];
    if (!user) throw notFound("User not found");

    const result = await db.query(
        `SELECT r.id, r.entity_type, r.body, r.created_at, ra.score,
            COALESCE(al.title, so.title) AS entity_name,
            COALESCE(al.cover_url, songAlbum.cover_url) AS cover_url,
            COALESCE(al.external_id, so.external_id) AS spotify_id,
            songAlbum.external_id AS album_spotify_id
        FROM reviews r
        LEFT JOIN albums al ON al.id = r.entity_id AND r.entity_type = 'album'
        LEFT JOIN songs so ON so.id = r.entity_id AND r.entity_type = 'song'
        LEFT JOIN albums songAlbum ON songAlbum.id = so.album_id
        LEFT JOIN ratings ra ON ra.id = r.rating_id
        WHERE r.user_id = $1
        ORDER BY r.created_at DESC
        LIMIT $2 OFFSET $3`,
        [user.id, limit, offset]
    );
    res.json(result.rows);
});

async function getReviewsForEntity(
    entityType: "album" | "song",
    entityId: number,
    viewerId: number
) {
    const result = await db.query(
        `SELECT r.id, r.body, r.created_at, ra.score,
            u.username, u.display_name, u.avatar_url,
            COUNT(rl.id)::int AS like_count,
            COALESCE(BOOL_OR(rl.user_id = $3), false) AS liked_by_me
        FROM reviews r
        JOIN users u ON u.id = r.user_id
        LEFT JOIN ratings ra ON ra.id = r.rating_id
        LEFT JOIN review_likes rl ON rl.review_id = r.id
        WHERE r.entity_type = $1 AND r.entity_id = $2
        GROUP BY r.id, ra.score, u.username, u.display_name, u.avatar_url
        ORDER BY like_count DESC, r.created_at DESC`,
        [entityType, entityId, viewerId]
    );
    return result.rows;
}

router.get("/albums/:spotifyId", requireAuth, async (req, res) => {
    const albumId = await getAlbumIdBySpotifyId(req.params.spotifyId as string);
    if (!albumId) {
        res.json([]);
        return;
    }
    res.json(await getReviewsForEntity("album", albumId, req.user!.id));
});

router.get("/songs/:spotifyId", requireAuth, async (req, res) => {
    const songId = await getSongIdBySpotifyId(req.params.spotifyId as string);
    if (!songId) {
        res.json([]);
        return;
    }
    res.json(await getReviewsForEntity("song", songId, req.user!.id));
});

router.post("/:id/like", requireAuth, async (req, res) => {
    await db.query(
        `INSERT INTO review_likes (review_id, user_id) VALUES ($1, $2)
        ON CONFLICT (review_id, user_id) DO NOTHING`,
        [req.params.id, req.user!.id]
    );
    res.status(201).json({ message: "Liked" });
});

router.delete("/:id/like", requireAuth, async (req, res) => {
    await db.query(
        `DELETE FROM review_likes WHERE review_id = $1 AND user_id = $2`,
        [req.params.id, req.user!.id]
    );
    res.json({ message: "Unliked" });
});

const reviewSchema = z.object({
    body: z.string().min(1).max(20000),
});

router.post("/albums/:spotifyId", requireAuth, async (req, res) => {
    const { body } = reviewSchema.parse(req.body);
    const albumId = await getOrCreateAlbum(req.params.spotifyId as string);
    const ratingId = await findRatingId(req.user!.id, "album", albumId);

    const result = await db.query<{ id: number; body: string; rating_id: number | null; created_at: string }>(
        `INSERT INTO reviews (user_id, entity_type, entity_id, rating_id, body)
        VALUES ($1, 'album', $2, $3, $4)
        RETURNING id, body, rating_id, created_at`,
        [req.user!.id, albumId, ratingId, body]
    );
    res.status(201).json(result.rows[0]);
});

const reviewSongSchema = z.object({
    body: z.string().min(1).max(20000),
    albumSpotifyId: z.string(),
});

router.post("/songs/:spotifyId", requireAuth, async (req, res) => {
    const { body, albumSpotifyId } = reviewSongSchema.parse(req.body);
    const songId = await getOrCreateSongByTrackId(req.params.spotifyId as string, albumSpotifyId);
    const ratingId = await findRatingId(req.user!.id, "song", songId);

    const result = await db.query<{ id: number; body: string; rating_id: number | null; created_at: string }>(
        `INSERT INTO reviews (user_id, entity_type, entity_id, rating_id, body)
        VALUES ($1, 'song', $2, $3, $4)
        RETURNING id, body, rating_id, created_at`,
        [req.user!.id, songId, ratingId, body]
    );
    res.status(201).json(result.rows[0]);
});

router.patch("/:id", requireAuth, async (req, res) => {
    const { body } = reviewSchema.parse(req.body);

    const result = await db.query<{ id: number; body: string; updated_at: string }>(
        `UPDATE reviews SET body = $1, updated_at = now()
        WHERE id = $2 AND user_id = $3
        RETURNING id, body, updated_at`,
        [body, req.params.id as string, req.user!.id]
    );
    if (!result.rows[0]) throw notFound("Review not found");
    res.json(result.rows[0]);
});

router.delete("/:id", requireAuth, async (req, res) => {
    const result = await db.query(
        `DELETE FROM reviews WHERE id = $1 AND user_id = $2 RETURNING id`,
        [req.params.id as string, req.user!.id]
    );
    if (!result.rows[0]) throw notFound("Review not found");
    res.json({ message: "Review deleted successfully" });
});

export default router;
