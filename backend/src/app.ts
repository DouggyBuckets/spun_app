import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import routes from "./routes";

export function createApp() {
    const app = express();

    app.use(helmet());
    app.use(cors({ origin: config.corsOrigin }));
    // Default 100kb is too small for a base64-encoded avatar image in the request body.
    app.use(express.json({ limit: "8mb" }));

    app.get("/health", (_req, res) => res.json( { status: "ok" }));

    app.use("/api", routes);

    app.use((_req, res) => res.status(404).json({ error: "Not found" }));
    app.use(errorHandler);

    return app;
}