import { Router } from "express";
import { z } from "zod";
import { db } from "../../db";
import { badRequest, notFound } from "../../errors";
import { requireAuth } from "../../middleware/auth";
import { getOrCreateAlbum, getOrCreateSongByTrackId } from "../catalog/catalogImport";

const router = Router();

async function resolveRecipient(username: string, senderId: number) {
    const result = await db.query<{ id: number }>(
        `SELECT id FROM users WHERE username = $1`, [username]
    );
    const recipient = result.rows[0];
    if (!recipient) throw notFound("User not found");
    if (recipient.id === senderId) throw badRequest("You can't recommend something to yourself");
    return recipient.id;
}

const recommendAlbumSchema = z.object({
    recipientUsername: z.string(),
    note: z.string().max(280).optional(),
});

router.post("/albums/:spotifyId", requireAuth, async (req, res) => {
    const { recipientUsername, note } = recommendAlbumSchema.parse(req.body);
    const recipientId = await resolveRecipient(recipientUsername, req.user!.id);
    const albumId = await getOrCreateAlbum(req.params.spotifyId as string);

    const result = await db.query(
        `INSERT INTO recommendations (sender_id, recipient_id, entity_type, entity_id, note)
        VALUES ($1, $2, 'album', $3, $4)
        RETURNING id, created_at`,
        [req.user!.id, recipientId, albumId, note ?? null]
    );
    res.status(201).json(result.rows[0]);
});

const recommendSongSchema = recommendAlbumSchema.extend({
    albumSpotifyId: z.string(),
});

router.post("/songs/:spotifyId", requireAuth, async (req, res) => {
    const { recipientUsername, note, albumSpotifyId } = recommendSongSchema.parse(req.body);
    const recipientId = await resolveRecipient(recipientUsername, req.user!.id);
    const songId = await getOrCreateSongByTrackId(req.params.spotifyId as string, albumSpotifyId);

    const result = await db.query(
        `INSERT INTO recommendations (sender_id, recipient_id, entity_type, entity_id, note)
        VALUES ($1, $2, 'song', $3, $4)
        RETURNING id, created_at`,
        [req.user!.id, recipientId, songId, note ?? null]
    );
    res.status(201).json(result.rows[0]);
});

router.get("/", requireAuth, async (req, res) => {
    const result = await db.query(
        `SELECT r.id, r.entity_type, r.entity_id, r.note, r.is_read, r.created_at,
            u.username AS sender_username, u.display_name AS sender_display_name,
            COALESCE(al.title, so.title) AS entity_name,
            COALESCE(al.external_id, so.external_id) AS spotify_id
        FROM recommendations r
        JOIN users u ON u.id = r.sender_id
        LEFT JOIN albums al ON al.id = r.entity_id AND r.entity_type = 'album'
        LEFT JOIN songs so ON so.id = r.entity_id AND r.entity_type = 'song'
        WHERE r.recipient_id = $1
        ORDER BY r.created_at DESC`,
        [req.user!.id]
    );
    res.json(result.rows);
});

router.patch("/:id/read", requireAuth, async (req, res) => {
    const result = await db.query(
        `UPDATE recommendations SET is_read = true
        WHERE id = $1 AND recipient_id = $2
        RETURNING id`,
        [req.params.id, req.user!.id]
    );
    if (!result.rows[0]) throw notFound("Recommendation not found");
    res.json({ message: "Marked as read" });
});

router.delete("/:id", requireAuth, async (req, res) => {
    const result = await db.query(
        `DELETE FROM recommendations WHERE id = $1 AND recipient_id = $2 RETURNING id`,
        [req.params.id, req.user!.id]
    );
    if (!result.rows[0]) throw notFound("Recommendation not found");
    res.json({ message: "Recommendation deleted" });
});

export default router;
