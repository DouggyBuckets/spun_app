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

router.get("/albums/:spotifyId", requireAuth, async (req, res) => {
    const albumId = await getAlbumIdBySpotifyId(req.params.spotifyId as string);
    if (!albumId) {
        res.json({ inQueue: false });
        return;
    }
    const result = await db.query(
        `SELECT id FROM listen_later WHERE user_id = $1 AND entity_type = 'album' AND entity_id = $2`,
        [req.user!.id, albumId]
    );
    res.json({ inQueue: !!result.rows[0] });
});

router.get("/songs/:spotifyId", requireAuth, async (req, res) => {
    const songId = await getSongIdBySpotifyId(req.params.spotifyId as string);
    if (!songId) {
        res.json({ inQueue: false });
        return;
    }
    const result = await db.query(
        `SELECT id FROM listen_later WHERE user_id = $1 AND entity_type = 'song' AND entity_id = $2`,
        [req.user!.id, songId]
    );
    res.json({ inQueue: !!result.rows[0] });
});

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
        `SELECT ll.id, ll.entity_type, ll.created_at,
            COALESCE(al.title, so.title) AS entity_name,
            COALESCE(al.cover_url, songAlbum.cover_url) AS cover_url,
            COALESCE(al.external_id, so.external_id) AS spotify_id,
            songAlbum.external_id AS album_spotify_id
        FROM listen_later ll
        LEFT JOIN albums al ON al.id = ll.entity_id AND ll.entity_type = 'album'
        LEFT JOIN songs so ON so.id = ll.entity_id AND ll.entity_type = 'song'
        LEFT JOIN albums songAlbum ON songAlbum.id = so.album_id
        WHERE ll.user_id = $1
        ORDER BY ll.created_at DESC`,
        [req.user!.id]
    );
    res.json(result.rows);
});

export default router;
