import { Pool } from "pg";
import { config } from "./config";

export const pool = new Pool({connectionString: config.databaseUrl});

export const db = {
  query: <T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ) => pool.query<T>(text, params),
};