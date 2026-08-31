import { Router } from "express";
import { db } from "../../db";
import { notFound } from "../../errors";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";

const router = Router();

router.get("/:username", async (req, res) => {
    const result = await db.query(
        `SELECT id, username, display_name, bio, avatar_url, created_at FROM users 
        WHERE username = $1`, [req.params.username]
    );
    if (!result.rows[0]) throw notFound("User not found");
    res.json(result.rows[0]);
})

const updateProfileSchema = z.object({
    displayName: z.string().max(50).optional(),
    bio: z.string().max(160).optional(),
    avatarUrl: z.string().url().max(255).optional(),
})

router.patch("/me", requireAuth, async (req, res) => {
    const {displayName, bio, avatarUrl} = updateProfileSchema.parse(req.body);
    const result = await db.query(
        `UPDATE users SET display_name = COALESCE($1, display_name),
        bio = COALESCE($2, bio), avatar_url = COALESCE($3, avatar_url)
        WHERE id = $4 RETURNING id, username, display_name, bio, avatar_url`,
        [displayName ?? null, bio ?? null, avatarUrl ?? null, req.user!.id]
    );
    res.json(result.rows[0]);
});

export default router;