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