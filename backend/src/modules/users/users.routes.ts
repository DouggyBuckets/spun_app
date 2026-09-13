import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../../db";
import { notFound, unauthorized } from "../../errors";
import { z } from "zod";
import { requireAuth, optionalAuth } from "../../middleware/auth";
import { uploadAvatar } from "./cloudinary";
import { areBlocked } from "../blocks/blocksHelper";

const router = Router();

router.get("/", optionalAuth, async (req, res) => {
    const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
    if (!query) {
        res.json([]);
        return;
    }

    const result = await db.query(
        `SELECT id, username, display_name, avatar_url FROM users
        WHERE (username ILIKE $1 OR display_name ILIKE $1)
        AND ($2::int IS NULL OR id NOT IN (
            SELECT blocked_id FROM blocks WHERE blocker_id = $2
            UNION
            SELECT blocker_id FROM blocks WHERE blocked_id = $2
        ))
        ORDER BY username
        LIMIT 20`,
        [`%${query}%`, req.user?.id ?? null]
    );
    res.json(result.rows);
});

router.get("/:username", optionalAuth, async (req, res) => {
    const result = await db.query<{
        id: number;
        username: string;
        display_name: string | null;
        bio: string | null;
        avatar_url: string | null;
        created_at: string;
    }>(
        `SELECT id, username, display_name, bio, avatar_url, created_at FROM users
        WHERE username = $1`, [req.params.username]
    );
    const user = result.rows[0];
    if (!user) throw notFound("User not found");

    // A block hides the profile entirely, in either direction — the blocked
    // person never learns they've been blocked, they just see "not found".
    if (req.user && (await areBlocked(req.user.id, user.id))) {
        throw notFound("User not found");
    }

    const counts = await db.query<{ follower_count: string; following_count: string }>(
        `SELECT
            (SELECT COUNT(*) FROM follows WHERE followee_id = $1) AS follower_count,
            (SELECT COUNT(*) FROM follows WHERE follower_id = $1) AS following_count`,
        [user.id]
    );

    let isFollowing: boolean | null = null;
    if (req.user) {
        const followCheck = await db.query(
            `SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2`,
            [req.user.id, user.id]
        );
        isFollowing = followCheck.rows.length > 0;
    }

    res.json({
        ...user,
        followerCount: Number(counts.rows[0]!.follower_count),
        followingCount: Number(counts.rows[0]!.following_count),
        isFollowing,
    });
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

const avatarUploadSchema = z.object({
    image: z.string().regex(
        /^data:image\/(png|jpe?g|webp);base64,/,
        "Must be a base64 image data URI"
    ),
});

router.post("/me/avatar", requireAuth, async (req, res) => {
    const { image } = avatarUploadSchema.parse(req.body);
    const url = await uploadAvatar(image, `user_${req.user!.id}`);

    const result = await db.query<{ avatar_url: string }>(
        `UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING avatar_url`,
        [url, req.user!.id]
    );
    res.json({ avatar_url: result.rows[0]!.avatar_url });
});

const deleteAccountSchema = z.object({
    password: z.string().min(1),
});

router.delete("/me", requireAuth, async (req, res) => {
    const { password } = deleteAccountSchema.parse(req.body);

    const result = await db.query<{ password_hash: string }>(
        `SELECT password_hash FROM users WHERE id = $1`, [req.user!.id]
    );
    const isMatch = await bcrypt.compare(password, result.rows[0]!.password_hash);
    if (!isMatch) throw unauthorized("Incorrect password");

    // Every table with a user_id/blocker_id/etc. FK cascades on delete, so
    // this one statement removes all of the account's data.
    await db.query(`DELETE FROM users WHERE id = $1`, [req.user!.id]);
    res.json({ message: "Account deleted" });
});

export default router;