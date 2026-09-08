import "dotenv/config";

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required env var: ${name}`);
    return value;
}

export const config = {
    port: Number(process.env.PORT ?? 4000),
    databaseUrl: required("DATABASE_URL"),
    jwtSecret: required("JWT_SECRET"),
    corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    spotifyClientId: required("SPOTIFY_CLIENT_ID"),
    spotifyClientSecret: required("SPOTIFY_CLIENT_SECRET"),
    // Optional (not required()) so the server keeps running before these are set up —
    // the avatar upload route checks for them itself and fails only that request.
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
};
