import { Router } from "express";
import { db } from "../../db";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { getOrCreateAlbum } from "../catalog/catalogImport";
import { badRequest, notFound } from "../../errors";

const router = Router();

router.get("/:username", async (req, res) => {
    const userResult = await db.query<{ id: number }>(
        `SELECT id FROM users WHERE username = $1`, [req.params.username]
    );
    const user = userResult.rows[0];
    if (!user) throw notFound("User not found");

    const result = await db.query(
        `SELECT f.position, al.external_id AS spotify_id, al.title, al.cover_url
        FROM favorites f
        JOIN albums al ON al.id = f.entity_id AND f.favorite_type = 'album'
        WHERE f.user_id = $1
        ORDER BY f.position`,
        [user.id]
    );
    res.json(result.rows);
});

const favoriteAlbumSchema = z.object({
    spotifyId: z.string(),
});

const positionSchema = z.object({
    position: z.coerce.number().int().min(1).max(4),
});

router.put("/albums/:position", requireAuth, async (req, res) => {
    const { spotifyId } = favoriteAlbumSchema.parse(req.body);
    const { position } = positionSchema.parse(req.params);
    const albumId = await getOrCreateAlbum(spotifyId);

    const existing = await db.query<{ position: number }>(
        `SELECT position FROM favorites
        WHERE user_id = $1 AND favorite_type = 'album' AND entity_id = $2 AND position != $3`,
        [req.user!.id, albumId, position]
    );
    if (existing.rows[0]) throw badRequest("Album is already one of your favorites");

    await db.query(
        `INSERT INTO favorites (user_id, favorite_type, entity_id, position)
        VALUES ($1, 'album', $2, $3)
        ON CONFLICT (user_id, favorite_type, position)
        DO UPDATE SET entity_id = $2`,
        [req.user!.id, albumId, position]
    );
    res.json({ message: "Favorite album set successfully" });
});

router.delete("/albums/:position", requireAuth, async (req, res) => {
    const { position } = positionSchema.parse(req.params);

    await db.query(
        `DELETE FROM favorites WHERE user_id = $1 AND favorite_type = 'album'
        AND position = $2`, [req.user!.id, position]
    );
    res.json({ message: "Favorite album deleted successfully" })
})

export default router;