import { Router } from "express";
import { db } from "../../db";
import { z } from "zod";
import { optionalAuth, requireAuth } from "../../middleware/auth";
import { getOrCreateAlbum, getAlbumIdBySpotifyId } from "../catalog/catalogImport";
import { notFound } from "../../errors";


const router = Router()

const listSchema = z.object({
    title: z.string().min(1).max(150),
    description: z.string().max(2000).optional(),
    isRanked: z.boolean().optional(),
    isPublic: z.boolean().optional(),
});

router.post("/", requireAuth, async (req, res) => {
    const { title, description, isRanked, isPublic } = listSchema.parse(req.body);
    const result = await db.query<{ id: number; title: string; description: string | null; is_ranked: boolean, is_public: boolean}>(
        `INSERT INTO lists (user_id, title, description, is_ranked, is_public)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, title, description, is_ranked, is_public`,
        [req.user!.id, title, description ?? null, isRanked ?? false, isPublic ?? true]
    );
    res.status(201).json(result.rows[0]);
});

router.get("/:id", optionalAuth, async (req, res) => {
    const listResult = await db.query<{ id: number; user_id: number; title: string; description: string | null; is_ranked: boolean, is_public: boolean}>(
        `SELECT * FROM lists WHERE id = $1`, [req.params.id]
    );
    const list = listResult.rows[0];
    if (!list) throw notFound("List not found");

    if (!list.is_public && list.user_id !== req.user?.id) {
        throw notFound("List not found");
    }

    const itemResult = await db.query(
        `SELECT * FROM list_items WHERE list_id = $1 ORDER BY position`,
        [list.id]
    );
    res.json({ ...list, items: itemResult.rows });
});

const updateListSchema = listSchema.partial();

router.patch("/:id", requireAuth, async (req, res) => {
    const { title, description, isRanked, isPublic } = updateListSchema.parse(req.body);
    const id = req.params.id;

    const result = await db.query<{ id: number; title: string; description: string | null; is_ranked: boolean; is_public: boolean }>(
        `UPDATE lists SET title = COALESCE($1, title), description = COALESCE($2, description),
        is_ranked = COALESCE($3, is_ranked), is_public = COALESCE($4, is_public),
        updated_at = now() WHERE id = $5 AND user_id = $6
        RETURNING id, title, description, is_ranked, is_public`,
        [title ?? null, description ?? null, isRanked ?? null, isPublic ?? null, id, req.user!.id]
    );
    if (!result.rows[0]) throw notFound("List not found");
    res.json(result.rows[0]);
});

router.delete("/:id", requireAuth, async (req, res) => {
    const result = await db.query(
        `DELETE FROM lists WHERE id = $1 AND user_id = $2 RETURNING id`,
        [req.params.id, req.user!.id]
    );
    if (!result.rows[0]) throw notFound("List not found");
    res.json({ message: "List deleted successfully" });
});

router.post("/:id/items/albums/:spotifyId", requireAuth, async (req, res) => {
    const listResult = await db.query<{ id: number; user_id: number; is_ranked: boolean}>(
        `SELECT id, user_id, is_ranked from lists WHERE id = $1`,
        [req.params.id]
    );
    const list = listResult.rows[0];
    if (!list || list.user_id !== req.user!.id) throw notFound("List not found");

    const albumId = await getOrCreateAlbum(req.params.spotifyId as string);

    let position: number | null = null;
    if (list.is_ranked) {
        const posResult = await db.query<{ next_position: number }>(
            `SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM list_items
            WHERE list_id = $1`, [list.id]
        );
        position = posResult.rows[0]!.next_position
    }

    await db.query (
        `INSERT INTO list_items (list_id, entity_type, entity_id, position)
        VALUES ($1, 'album', $2, $3)
        ON CONFLICT (list_id, entity_type, entity_id) DO NOTHING`,
        [list.id, albumId, position]
    );
    res.status(201).json({ message: "Added to list successfully" });
});


router.delete("/:id/items/albums/:spotifyId", requireAuth, async (req, res) => {
    const listResult = await db.query<{ id: number; user_id: number; is_ranked: boolean}>(
        `SELECT id, user_id, is_ranked from lists WHERE id = $1`,
        [req.params.id]
    );
    const list = listResult.rows[0];
    if (!list || list.user_id !== req.user!.id) throw notFound("List not found");

    const albumId = await getAlbumIdBySpotifyId(req.params.spotifyId as string);
    if (!albumId) throw notFound("Album not found");

    await db.query(
        `DELETE FROM list_items WHERE list_id = $1 AND entity_type = 'album'
        AND entity_id = $2`, [list.id, albumId]
    );
    res.json({ message: "Deleted from list successfully" });
});

export default router;