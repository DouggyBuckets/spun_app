import { Router } from "express";
import { z } from "zod";
import { searchAlbums, getAlbum, searchTracks, searchArtists, getArtistAlbums } from "./spotify";

const router = Router();

const searchSchema = z.object({
    query: z.string().min(1).max(100),
})

router.get("/search", async (req, res) => {
    const { query } = searchSchema.parse(req.query);
    const results = await searchAlbums(query);
    res.json(results);
})

router.get("/albums/:id", async (req, res) => {
    const albumDetails = await getAlbum(req.params.id);
    res.json(albumDetails);
})

router.get("/search/tracks", async (req, res) => {
    const { query } = searchSchema.parse(req.query);
    const results = await searchTracks(query);
    res.json(results);
})

router.get("/search/artists", async (req, res) => {
    const { query } = searchSchema.parse(req.query);
    const results = await searchArtists(query);
    res.json(results);
})

router.get("/artists/:id/albums", async (req, res) => {
    const albums = await getArtistAlbums(req.params.id);
    res.json(albums);
})

export default router;