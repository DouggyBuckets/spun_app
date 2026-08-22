import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { db } from "../../db";
import { signToken } from "./token";
import { unauthorized } from "../../errors";
import { requireAuth } from "../../middleware/auth";

const router = Router();

const registerSchema = z.object({
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
    email: z.email().max(255),
    password: z.string().min(8).max(72),
    displayName: z.string().max(50).optional(),
});

router.post("/register", async (req, res) => {
    const {username, email, password, displayName} = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.query<{id: number; username: string}>(
        `INSERT INTO users (username, email, password_hash, display_name)
            VALUES ($1, $2, $3, $4)
            RETURNING id, username`,
            [username, email, passwordHash, displayName ?? null]
    );
    const user = result.rows[0]!;
    const token = signToken({id: user.id, username: user.username});
    res.status(201).json({token, user});
})

const loginSchema = z.object({
    email: z.email().max(255),
    password: z.string().min(8).max(72),
})

router.post("/login", async (req, res) => {
    const {email, password} = loginSchema.parse(req.body);
    
    const result = await db.query<{id: number; username: string; password_hash: string}>(
        `SELECT id, username, password_hash FROM users WHERE email = $1`, [email]);
    const user = result.rows[0];
    if (!user) throw unauthorized("Invalid email or password");

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) throw unauthorized("Invalid email or password");

    const token = signToken({id: user.id, username: user.username});
    res.json({token, user: {id: user.id, username: user.username}});
})

router.get("/me", requireAuth, async (req, res) => {
    const result = await db.query(
        `SELECT id, username, email, display_name, bio, avatar_url, created_at FROM users WHERE id = $1`, [req.user!.id]);
    res.json(result.rows[0]);
})

export default router;