import { Router } from "express";
import { db } from "../../db";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";

const router = Router();

const feedQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
});

router.get("/", requireAuth, async (req, res) => {
    const { limit, offset } = feedQuerySchema.parse(req.query);

    const result = await db.query(
        `WITH followees AS (
            SELECT followee_id FROM follows WHERE follower_id = $1
        )
        SELECT 'rating' AS activity_type, r.user_id, u.username, u.display_name,
            r.entity_type::text AS entity_type, r.entity_id, r.id AS reference_id,
            COALESCE(al.title, so.title) AS entity_name, r.created_at
        FROM ratings r
        JOIN users u ON u.id = r.user_id
        LEFT JOIN albums al ON al.id = r.entity_id AND r.entity_type = 'album'
        LEFT JOIN songs so ON so.id = r.entity_id AND r.entity_type = 'song'
        WHERE r.user_id IN (SELECT followee_id FROM followees)

        UNION ALL

        SELECT 'review' AS activity_type, rv.user_id, u.username, u.display_name,
            rv.entity_type::text AS entity_type, rv.entity_id, rv.id AS reference_id,
            COALESCE(al.title, so.title) AS entity_name, rv.created_at
        FROM reviews rv
        JOIN users u ON u.id = rv.user_id
        LEFT JOIN albums al ON al.id = rv.entity_id AND rv.entity_type = 'album'
        LEFT JOIN songs so ON so.id = rv.entity_id AND rv.entity_type = 'song'
        WHERE rv.user_id IN (SELECT followee_id FROM followees)

        UNION ALL

        SELECT 'like' AS activity_type, l.user_id, u.username, u.display_name,
            l.entity_type::text AS entity_type, l.entity_id, l.id AS reference_id,
            COALESCE(al.title, so.title) AS entity_name, l.created_at
        FROM likes l
        JOIN users u ON u.id = l.user_id
        LEFT JOIN albums al ON al.id = l.entity_id AND l.entity_type = 'album'
        LEFT JOIN songs so ON so.id = l.entity_id AND l.entity_type = 'song'
        WHERE l.user_id IN (SELECT followee_id FROM followees)

        UNION ALL

        SELECT 'spin' AS activity_type, sp.user_id, u.username, u.display_name,
            sp.entity_type::text AS entity_type, sp.entity_id, sp.id AS reference_id,
            COALESCE(al.title, so.title) AS entity_name, sp.created_at
        FROM spins sp
        JOIN users u ON u.id = sp.user_id
        LEFT JOIN albums al ON al.id = sp.entity_id AND sp.entity_type = 'album'
        LEFT JOIN songs so ON so.id = sp.entity_id AND sp.entity_type = 'song'
        WHERE sp.user_id IN (SELECT followee_id FROM followees)

        UNION ALL

        SELECT 'follow' AS activity_type, f.follower_id AS user_id, u.username, u.display_name,
            'user' AS entity_type, f.followee_id AS entity_id, NULL::integer AS reference_id,
            followee.username AS entity_name, f.created_at
        FROM follows f
        JOIN users u ON u.id = f.follower_id
        JOIN users followee ON followee.id = f.followee_id
        WHERE f.follower_id IN (SELECT followee_id FROM followees)

        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
        [req.user!.id, limit, offset]
    );
    res.json(result.rows);
});

export default router;
