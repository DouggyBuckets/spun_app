import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import userRoutes from "../modules/users/users.routes";
import catalogRoutes from "../modules/catalog/catalog.routes";
import ratingRoutes from "../modules/ratings/ratings.routes";
import reviewRoutes from "../modules/reviews/reviews.routes";
import likeRoutes from "../modules/likes/likes.routes";
import favoriteRoutes from "../modules/favorites/favorites.routes";
import listRoutes from "../modules/lists/lists.routes";
import listenLaterRoutes from "../modules/listenLater/listenLater.routes";
import followRoutes from "../modules/follows/follows.routes";
import spinRoutes from "../modules/spins/spins.routes";
import feedRoutes from "../modules/feed/feed.routes";

const router = Router();
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/catalog", catalogRoutes);
router.use("/ratings", ratingRoutes);
router.use("/reviews", reviewRoutes);
router.use("/likes", likeRoutes);
router.use("/favorites", favoriteRoutes);
router.use("/lists", listRoutes);
router.use("/listen-later", listenLaterRoutes);
router.use("/follows", followRoutes);
router.use("/spins", spinRoutes);
router.use("/feed", feedRoutes);

export default router;