import { Router } from "express";
import { db } from "../../db";
import { badRequest, notFound } from "../../errors";
import { requireAuth } from "../../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
    const result = await db.query(
        `SELECT u.id, u.username, u.display_name, u.avatar_url
        FROM blocks b
        JOIN users u ON u.id = b.blocked_id
        WHERE b.blocker_id = $1
        ORDER BY b.created_at DESC`,
        [req.user!.id]
    );
    res.json(result.rows);
});

router.post("/:username", requireAuth, async (req, res) => {
    const blockerId = req.user!.id;

    const targetResult = await db.query<{ id: number }>(
        `SELECT id FROM users WHERE username = $1`, [req.params.username]
    );
    const target = targetResult.rows[0];
    if (!target) throw notFound("User not found");
    if (target.id === blockerId) throw badRequest("You can't block yourself");

    await db.query(
        `INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)
        ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
        [blockerId, target.id]
    );

    // A block also removes any existing follow relationship in either direction.
    await db.query(
        `DELETE FROM follows
        WHERE (follower_id = $1 AND followee_id = $2)
        OR (follower_id = $2 AND followee_id = $1)`,
        [blockerId, target.id]
    );

    res.status(201).json({ message: "User blocked" });
});

router.delete("/:username", requireAuth, async (req, res) => {
    const blockerId = req.user!.id;

    const targetResult = await db.query<{ id: number }>(
        `SELECT id FROM users WHERE username = $1`, [req.params.username]
    );
    const target = targetResult.rows[0];
    if (!target) throw notFound("User not found");

    await db.query(
        `DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
        [blockerId, target.id]
    );
    res.json({ message: "User unblocked" });
});

export default router;
