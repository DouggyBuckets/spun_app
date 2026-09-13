import { db } from "../../db";

export async function areBlocked(userIdA: number, userIdB: number): Promise<boolean> {
    const result = await db.query(
        `SELECT 1 FROM blocks
        WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)`,
        [userIdA, userIdB]
    );
    return result.rows.length > 0;
}
