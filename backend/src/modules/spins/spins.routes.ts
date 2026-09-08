import { Router } from "express";
import { z } from "zod";
import { db } from "../../db";
import { notFound, badRequest } from "../../errors";
import { requireAuth } from "../../middleware/auth";
import { getOrCreateAlbum, getOrCreateSongByTrackId } from "../catalog/catalogImport";

const router = Router();

async function findRatingId(userId: number, entityType: "album" | "song", entityId: number) {
    const result = await db.query<{ id: number }>(
        `SELECT id FROM ratings WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3`,
        [userId, entityType, entityId]
    );
    return result.rows[0]?.id ?? null;
}

async function assertOwnsReview(userId: number, reviewId: number) {
    const result = await db.query<{ id: number }>(
        `SELECT id FROM reviews WHERE id = $1 AND user_id = $2`, [reviewId, userId]
    );
    if (!result.rows[0]) throw badRequest("Review not found");
}

const spinSchema = z.object({
    listenedOn: z.string().optional(),
    reviewId: z.number().int().optional(),
});

router.post("/albums/:spotifyId", requireAuth, async (req, res) => {
    const { listenedOn, reviewId } = spinSchema.parse(req.body);
    const albumId = await getOrCreateAlbum(req.params.spotifyId as string);
    if (reviewId !== undefined) await assertOwnsReview(req.user!.id, reviewId);

    const ratingId = await findRatingId(req.user!.id, "album", albumId);

    const result = await db.query(
        `INSERT INTO spins (user_id, entity_type, entity_id, rating_id, review_id, listened_on)
        VALUES ($1, 'album', $2, $3, $4, COALESCE($5, CURRENT_DATE))
        RETURNING id, entity_type, entity_id, listened_on, rating_id, review_id`,
        [req.user!.id, albumId, ratingId, reviewId ?? null, listenedOn ?? null]
    );
    res.status(201).json(result.rows[0]);
});

const spinSongSchema = spinSchema.extend({
    albumSpotifyId: z.string(),
});

router.post("/songs/:spotifyId", requireAuth, async (req, res) => {
    const { listenedOn, reviewId, albumSpotifyId } = spinSongSchema.parse(req.body);
    const songId = await getOrCreateSongByTrackId(req.params.spotifyId as string, albumSpotifyId);
    if (reviewId !== undefined) await assertOwnsReview(req.user!.id, reviewId);

    const ratingId = await findRatingId(req.user!.id, "song", songId);

    const result = await db.query(
        `INSERT INTO spins (user_id, entity_type, entity_id, rating_id, review_id, listened_on)
        VALUES ($1, 'song', $2, $3, $4, COALESCE($5, CURRENT_DATE))
        RETURNING id, entity_type, entity_id, listened_on, rating_id, review_id`,
        [req.user!.id, songId, ratingId, reviewId ?? null, listenedOn ?? null]
    );
    res.status(201).json(result.rows[0]);
});

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
        `SELECT s.id, s.entity_type, s.listened_on, s.created_at,
            COALESCE(al.title, so.title) AS entity_name,
            COALESCE(al.cover_url, songAlbum.cover_url) AS cover_url,
            COALESCE(al.external_id, so.external_id) AS spotify_id,
            songAlbum.external_id AS album_spotify_id
        FROM spins s
        LEFT JOIN albums al ON al.id = s.entity_id AND s.entity_type = 'album'
        LEFT JOIN songs so ON so.id = s.entity_id AND s.entity_type = 'song'
        LEFT JOIN albums songAlbum ON songAlbum.id = so.album_id
        WHERE s.user_id = $1
        ORDER BY s.listened_on DESC, s.created_at DESC
        LIMIT $2 OFFSET $3`,
        [user.id, limit, offset]
    );
    res.json(result.rows);
});

router.get("/", requireAuth, async (req, res) => {
    const result = await db.query(
        `SELECT id, entity_type, entity_id, listened_on, rating_id, review_id
        FROM spins WHERE user_id = $1 ORDER BY listened_on DESC, created_at DESC`,
        [req.user!.id]
    );
    res.json(result.rows);
});

router.delete("/:id", requireAuth, async (req, res) => {
    const result = await db.query(
        `DELETE FROM spins WHERE id = $1 AND user_id = $2 RETURNING id`,
        [req.params.id, req.user!.id]
    );
    if (!result.rows[0]) throw notFound("Spin not found");
    res.json({ message: "Spin deleted successfully" });
});

export default router;
