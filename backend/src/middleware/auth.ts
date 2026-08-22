import { NextFunction, Request, Response } from "express";
import { unauthorized } from "../errors";
import { verifyToken } from "../modules/auth/token";

function extractToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return null;
    return header.slice("Bearer ".length);
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
    const token = extractToken(req);
    if (!token) return next(unauthorized("Missing bearer token"));

    try {
        req.user = verifyToken(token);
        next();
    } catch {
        next(unauthorized("Invalid or expired token"));
    }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
    const token = extractToken(req);
    if (!token) return next();
    try {
        req.user = verifyToken(token);
    } catch {
        // ignore invalid token — request proceeds unauthenticated
    }
    next();
}