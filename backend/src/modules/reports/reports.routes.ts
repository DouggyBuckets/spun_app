import { Router } from "express";
import { z } from "zod";
import { db } from "../../db";
import { badRequest, notFound } from "../../errors";
import { requireAuth } from "../../middleware/auth";

const router = Router();

const reportSchema = z.discriminatedUnion("targetType", [
    z.object({
        targetType: z.literal("user"),
        username: z.string(),
        reason: z.string().min(1).max(500),
    }),
    z.object({
        targetType: z.literal("review"),
        reviewId: z.number().int(),
        reason: z.string().min(1).max(500),
    }),
]);

router.post("/", requireAuth, async (req, res) => {
    const body = reportSchema.parse(req.body);

    let targetId: number;
    if (body.targetType === "user") {
        const result = await db.query<{ id: number }>(
            `SELECT id FROM users WHERE username = $1`, [body.username]
        );
        const target = result.rows[0];
        if (!target) throw notFound("User not found");
        if (target.id === req.user!.id) throw badRequest("You can't report yourself");
        targetId = target.id;
    } else {
        const result = await db.query<{ id: number }>(
            `SELECT id FROM reviews WHERE id = $1`, [body.reviewId]
        );
        if (!result.rows[0]) throw notFound("Review not found");
        targetId = body.reviewId;
    }

    await db.query(
        `INSERT INTO reports (reporter_id, target_type, target_id, reason)
        VALUES ($1, $2, $3, $4)`,
        [req.user!.id, body.targetType, targetId, body.reason]
    );
    res.status(201).json({ message: "Report submitted" });
});

export default router;
