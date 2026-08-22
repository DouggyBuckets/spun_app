import { NextFunction, Request, Response } from "express";
import { z, ZodError } from "zod";
import { AppError } from "../errors";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
    if (err instanceof AppError) {
        return res.status(err.status).json({ error: err.message });
    }
    else if (err instanceof ZodError) {
        return res.status(400).json({ error: "Validation failed", details: z.treeifyError(err) })
    }
    // Postgres unique_violation
    else if (typeof err === "object" && err != null && (err as { code?: string}).code === "23505") {
        return res.status(409).json({ error: "Resource already exists" });
    }

    console.error(err);
    return res.status(500).json( { error: "Internal server error" });
}