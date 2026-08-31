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

router.post("/albums/:spotifyId", requireAuth, async (req, res) => {
    const albumId = await getOrCreateAlbum(req.params.spotifyId as string);
    await db.query(
        `INSERT INTO listen_later (user_id, entity_type, entity_id)
        VALUES ($1, 'album', $2)
        ON CONFLICT (user_id, entity_type, entity_id) DO NOTHING`,
        [req.user!.id, albumId]
    );
    res.status(201).json({ message: "Added to Listen Later" });
});

const listenLaterSongSchema = z.object({
    albumSpotifyId: z.string(),
});

router.post("/songs/:spotifyId", requireAuth, async (req, res) => {
    const { albumSpotifyId } = listenLaterSongSchema.parse(req.body);
    const songId = await getOrCreateSongByTrackId(req.params.spotifyId as string, albumSpotifyId);
    await db.query(
        `INSERT INTO listen_later (user_id, entity_type, entity_id)
        VALUES ($1, 'song', $2)
        ON CONFLICT (user_id, entity_type, entity_id) DO NOTHING`,
        [req.user!.id, songId]
    );
    res.status(201).json({ message: "Added to Listen Later" });
});

router.delete("/albums/:spotifyId", requireAuth, async (req, res) => {
    const albumId = await getAlbumIdBySpotifyId(req.params.spotifyId as string);
    if (!albumId) throw notFound("Album not found");

    await db.query(
        `DELETE FROM listen_later WHERE user_id = $1 AND entity_type = 'album' AND entity_id = $2`,
        [req.user!.id, albumId]
    );
    res.json({ message: "Removed from Listen Later" });
});

router.delete("/songs/:spotifyId", requireAuth, async (req, res) => {
    const songId = await getSongIdBySpotifyId(req.params.spotifyId as string);
    if (!songId) throw notFound("Song not found");

    await db.query(
        `DELETE FROM listen_later WHERE user_id = $1 AND entity_type = 'song' AND entity_id = $2`,
        [req.user!.id, songId]
    );
    res.json({ message: "Removed from Listen Later" });
});

router.get("/", requireAuth, async (req, res) => {
    const result = await db.query(
        `SELECT id, entity_type, entity_id, created_at FROM listen_later
        WHERE user_id = $1 ORDER BY created_at DESC`,
        [req.user!.id]
    );
    res.json(result.rows);
});

export default router;
