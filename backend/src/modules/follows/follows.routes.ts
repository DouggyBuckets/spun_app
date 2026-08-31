import { Router } from "express";
import { db } from "../../db";
import { requireAuth } from "../../middleware/auth";
import { badRequest, notFound } from "../../errors";

const router = Router();

router.post("/:username", requireAuth, async (req, res) => {
    const followerId = req.user!.id;

    const followeeResult = await db.query<{ id: number }>(
        `SELECT id FROM users WHERE username = $1`, [req.params.username]
    );
    const followee = followeeResult.rows[0];
    if (!followee) throw notFound("User not found");
    if (followee.id === followerId) throw badRequest("You can't follow yourself");

    await db.query(
        `INSERT INTO follows (follower_id, followee_id)
        VALUES ($1, $2)
        ON CONFLICT (follower_id, followee_id) DO NOTHING`,
        [followerId, followee.id]
    );
    res.status(201).json({ message: "Followed successfully" });
});

router.delete("/:username", requireAuth, async (req, res) => {
    const followerId = req.user!.id;

    const followeeResult = await db.query<{ id: number }>(
        `SELECT id FROM users WHERE username = $1`, [req.params.username]
    );
    const followee = followeeResult.rows[0];
    if (!followee) throw notFound("User not found");

    await db.query(
        `DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2`,
        [followerId, followee.id]
    );
    res.json({ message: "Unfollowed successfully" });
});

router.get("/:username/followers", async (req, res) => {
    const userResult = await db.query<{ id: number }>(
        `SELECT id FROM users WHERE username = $1`, [req.params.username]
    );
    const user = userResult.rows[0];
    if (!user) throw notFound("User not found");

    const result = await db.query(
        `SELECT u.id, u.username, u.display_name, u.avatar_url
        FROM follows f
        JOIN users u ON u.id = f.follower_id
        WHERE f.followee_id = $1
        ORDER BY f.created_at DESC`,
        [user.id]
    );
    res.json(result.rows);
});

router.get("/:username/following", async (req, res) => {
    const userResult = await db.query<{ id: number }>(
        `SELECT id FROM users WHERE username = $1`, [req.params.username]
    );
    const user = userResult.rows[0];
    if (!user) throw notFound("User not found");

    const result = await db.query(
        `SELECT u.id, u.username, u.display_name, u.avatar_url
        FROM follows f
        JOIN users u ON u.id = f.followee_id
        WHERE f.follower_id = $1
        ORDER BY f.created_at DESC`,
        [user.id]
    );
    res.json(result.rows);
});

export default router;