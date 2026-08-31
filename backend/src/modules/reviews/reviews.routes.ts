import { Router } from "express";
import { z } from "zod";
import { db } from "../../db";
import { notFound } from "../../errors";
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
