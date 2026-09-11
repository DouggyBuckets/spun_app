import { useEffect, useState } from "react";
import {
    View,
    Text,
    Image,
    FlatList,
    TextInput,
    StyleSheet,
    ActivityIndicator,
    Modal,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, ApiError } from "../../api/client";
import { colors, spacing, radius, cardShadow, fonts } from "../../constants/theme";
import { StarRating } from "../../components/StarRating";
import { useToggle } from "../../hooks/useToggle";
import { Touchable } from "../../components/Touchable";
import { BackButton } from "../../components/BackButton";

interface Track {
    id: string;
    name: string;
    track_number: number;
    duration_ms: number;
    artists: { id: string; name: string }[];
}

interface AlbumDetails {
    id: string;
    name: string;
    artists: { id: string; name: string }[];
    images: { url: string }[];
    release_date: string;
    album_type: string;
    tracks: { items: Track[] };
}

interface RatingResponse {
    score: number | null;
    averageScore: number | null;
    ratingCount: number;
}

interface TrackRating {
    spotifyId: string;
    averageScore: number;
    ratingCount: number;
}

interface AlbumReview {
    id: number;
    body: string;
    score: number | null;
    created_at: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    like_count: number;
    liked_by_me: boolean;
}

function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function AlbumDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [album, setAlbum] = useState<AlbumDetails | null>(null);
    const [myRating, setMyRating] = useState<number | null>(null);
    const [averageScore, setAverageScore] = useState<number | null>(null);
    const [ratingCount, setRatingCount] = useState(0);
    const [reviews, setReviews] = useState<AlbumReview[]>([]);
    const [trackRatings, setTrackRatings] = useState<Record<string, TrackRating>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [ratingError, setRatingError] = useState<string | null>(null);
    const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const like = useToggle(`/likes/albums/${id}`, "liked");
    const listenLater = useToggle(`/listen-later/albums/${id}`, "inQueue");

    // "log this listen" (a Spin) — not a toggle, just an action that adds a new entry each time
    const [isLogging, setIsLogging] = useState(false);
    const [justLogged, setJustLogged] = useState(false);
    const [logError, setLogError] = useState<string | null>(null);

    // review
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [reviewBody, setReviewBody] = useState("");
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [reviewSubmitted, setReviewSubmitted] = useState(false);
    const [reviewError, setReviewError] = useState<string | null>(null);

    // recommend
    const [isRecommendOpen, setIsRecommendOpen] = useState(false);
    const [recipientUsername, setRecipientUsername] = useState("");
    const [recommendNote, setRecommendNote] = useState("");
    const [isSendingRecommendation, setIsSendingRecommendation] = useState(false);
    const [recommendSent, setRecommendSent] = useState(false);
    const [recommendError, setRecommendError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const [albumData, ratingData, reviewsData, trackRatingsData] = await Promise.all([
                    apiFetch<AlbumDetails>(`/catalog/albums/${id}`),
                    apiFetch<RatingResponse>(`/ratings/albums/${id}`),
                    apiFetch<AlbumReview[]>(`/reviews/albums/${id}`),
                    apiFetch<TrackRating[]>(`/ratings/albums/${id}/tracks`),
                ]);
                setAlbum(albumData);
                setMyRating(ratingData.score);
                setAverageScore(ratingData.averageScore);
                setRatingCount(ratingData.ratingCount);
                setReviews(reviewsData);
                setTrackRatings(
                    Object.fromEntries(trackRatingsData.map((t) => [t.spotifyId, t]))
                );
            } catch (err) {
                setError(err instanceof ApiError ? err.message : "Something went wrong");
            } finally {
                setIsLoading(false);
            }
        })();
    }, [id]);

    async function refreshReviews() {
        try {
            setReviews(await apiFetch<AlbumReview[]>(`/reviews/albums/${id}`));
        } catch {
            // non-critical — the new review still posted successfully
        }
    }

    async function handleToggleReviewLike(review: AlbumReview) {
        const next = !review.liked_by_me;
        setReviews((prev) =>
            prev.map((r) =>
                r.id === review.id
                    ? { ...r, liked_by_me: next, like_count: r.like_count + (next ? 1 : -1) }
                    : r
            )
        );
        try {
            await apiFetch(`/reviews/${review.id}/like`, { method: next ? "POST" : "DELETE" });
        } catch {
            setReviews((prev) =>
                prev.map((r) =>
                    r.id === review.id
                        ? { ...r, liked_by_me: !next, like_count: r.like_count + (next ? -1 : 1) }
                        : r
                )
            );
        }
    }

    async function handleRate(score: number) {
        setRatingError(null);
        const previousRating = myRating;
        setMyRating(score);
        setIsRatingModalOpen(false);
        try {
            await apiFetch(`/ratings/albums/${id}`, {
                method: "POST",
                body: JSON.stringify({ score }),
            });
        } catch (err) {
            setMyRating(previousRating);
            setRatingError(err instanceof ApiError ? err.message : "Something went wrong");
        }
    }

    async function handleLog() {
        setLogError(null);
        setJustLogged(false);
        setIsLogging(true);
        try {
            await apiFetch(`/spins/albums/${id}`, {
                method: "POST",
                body: JSON.stringify({}),
            });
            setJustLogged(true);
        } catch (err) {
            setLogError(err instanceof ApiError ? err.message : "Something went wrong");
        } finally {
            setIsLogging(false);
        }
    }

    async function handleSubmitReview() {
        if (!reviewBody.trim()) return;
        setReviewError(null);
        setIsSubmittingReview(true);
        try {
            await apiFetch(`/reviews/albums/${id}`, {
                method: "POST",
                body: JSON.stringify({ body: reviewBody }),
            });
            setReviewSubmitted(true);
            setReviewBody("");
            setIsReviewOpen(false);
            await refreshReviews();
        } catch (err) {
            setReviewError(err instanceof ApiError ? err.message : "Something went wrong");
        } finally {
            setIsSubmittingReview(false);
        }
    }

    async function handleSendRecommendation() {
        if (!recipientUsername.trim()) return;
        setRecommendError(null);
        setIsSendingRecommendation(true);
        try {
            await apiFetch(`/recommendations/albums/${id}`, {
                method: "POST",
                body: JSON.stringify({
                    recipientUsername,
                    note: recommendNote || undefined,
                }),
            });
            setRecommendSent(true);
            setRecipientUsername("");
            setRecommendNote("");
            setIsRecommendOpen(false);
        } catch (err) {
            setRecommendError(err instanceof ApiError ? err.message : "Something went wrong");
        } finally {
            setIsSendingRecommendation(false);
        }
    }

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={colors.accent} />
            </View>
        );
    }

    if (error || !album) {
        return (
            <View style={styles.centered}>
                <Text style={styles.error}>{error ?? "Album not found"}</Text>
            </View>
        );
    }

    return (
        <FlatList
            style={styles.container}
            data={album.tracks.items}
            keyExtractor={(track) => track.id}
            ListHeaderComponent={
                <View style={styles.header}>
                    <View style={styles.topBar}>
                        <BackButton />
                    </View>
                    {album.images[0] && (
                        <Image source={{ uri: album.images[0].url }} style={styles.cover} />
                    )}
                    <Text style={styles.title}>{album.name}</Text>
                    <Text style={styles.artist}>
                        {album.artists.map((a) => a.name).join(", ")}
                    </Text>
                    <Text style={styles.meta}>
                        {album.release_date.slice(0, 4)} · {album.tracks.items.length} tracks
                    </Text>

                    <View style={styles.statsCard}>
                        <View style={styles.statColumn}>
                            <Text style={styles.statNumber}>{ratingCount}</Text>
                            <Text style={styles.statLabel}>
                                {ratingCount === 1 ? "Rating" : "Ratings"}
                            </Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statColumn}>
                            <View style={styles.statValueRow}>
                                {averageScore !== null && (
                                    <Ionicons name="star" size={13} color={colors.rating} />
                                )}
                                <Text style={styles.statNumber}>
                                    {averageScore !== null ? (averageScore / 2).toFixed(1) : "—"}
                                </Text>
                            </View>
                            <Text style={styles.statLabel}>Average</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <Touchable style={styles.statColumn} onPress={() => setIsRatingModalOpen(true)}>
                            <View
                                style={[
                                    styles.statValueRow,
                                    myRating !== null && styles.yourRatingPill,
                                ]}
                            >
                                {myRating !== null && (
                                    <Ionicons name="star" size={13} color={colors.rating} />
                                )}
                                <Text
                                    style={[
                                        styles.statNumber,
                                        myRating === null && styles.statNumberMuted,
                                    ]}
                                >
                                    {myRating !== null ? (myRating / 2).toFixed(1) : "Rate"}
                                </Text>
                            </View>
                            <Text style={styles.statLabel}>Your Rating</Text>
                        </Touchable>
                    </View>
                    {ratingError && <Text style={styles.error}>{ratingError}</Text>}

                    <View style={styles.actionRow}>
                        <Touchable style={styles.actionButton} onPress={like.toggle} disabled={like.isLoading}>
                            <Ionicons
                                name={like.isOn ? "heart" : "heart-outline"}
                                size={22}
                                color={colors.like}
                            />
                        </Touchable>
                        <Touchable
                            style={styles.actionButton}
                            onPress={listenLater.toggle}
                            disabled={listenLater.isLoading}
                        >
                            <Ionicons
                                name={listenLater.isOn ? "bookmark" : "bookmark-outline"}
                                size={22}
                                color={colors.accent}
                            />
                        </Touchable>
                        <Touchable style={styles.actionButton} onPress={() => setIsReviewOpen((v) => !v)}>
                            <Ionicons name="create-outline" size={22} color={colors.accent} />
                        </Touchable>
                        <Touchable style={styles.actionButton} onPress={() => setIsMenuOpen(true)}>
                            <Ionicons name="ellipsis-horizontal" size={22} color={colors.textMuted} />
                        </Touchable>
                    </View>
                    {justLogged && <Text style={styles.confirmText}>Logged ✓</Text>}
                    {(like.error || listenLater.error || logError) && (
                        <Text style={styles.error}>{like.error || listenLater.error || logError}</Text>
                    )}

                    <Modal
                        visible={isRatingModalOpen}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setIsRatingModalOpen(false)}
                    >
                        <Touchable
                            style={styles.ratingModalBackdrop}
                            onPress={() => setIsRatingModalOpen(false)}
                        />
                        <View style={styles.ratingModalCenter} pointerEvents="box-none">
                            <View style={styles.ratingModalCard}>
                                <Text style={styles.ratingModalTitle}>Rate this Album</Text>
                                <StarRating score={myRating} onRate={handleRate} />
                            </View>
                        </View>
                    </Modal>

                    <Modal
                        visible={isMenuOpen}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setIsMenuOpen(false)}
                    >
                        <Touchable style={styles.menuBackdrop} onPress={() => setIsMenuOpen(false)} />
                        <View style={styles.menuSheet}>
                            <Touchable
                                style={styles.menuRow}
                                onPress={() => {
                                    setIsMenuOpen(false);
                                    handleLog();
                                }}
                                disabled={isLogging}
                            >
                                <Ionicons name="add-circle-outline" size={20} color={colors.text} />
                                <Text style={styles.menuRowText}>
                                    {isLogging ? "Logging..." : "Log listen"}
                                </Text>
                            </Touchable>
                            <Touchable
                                style={styles.menuRow}
                                onPress={() => {
                                    setIsMenuOpen(false);
                                    router.push({ pathname: "/lists/add-to", params: { albumId: id } });
                                }}
                            >
                                <Ionicons name="list-outline" size={20} color={colors.text} />
                                <Text style={styles.menuRowText}>Add to list</Text>
                            </Touchable>
                            <Touchable
                                style={styles.menuRow}
                                onPress={() => {
                                    setIsMenuOpen(false);
                                    setIsRecommendOpen(true);
                                }}
                            >
                                <Ionicons name="paper-plane-outline" size={20} color={colors.text} />
                                <Text style={styles.menuRowText}>
                                    {recommendSent ? "Recommend to someone else" : "Recommend to a friend"}
                                </Text>
                            </Touchable>
                        </View>
                    </Modal>

                    {isReviewOpen && (
                        <View style={styles.formCard}>
                            <TextInput
                                style={styles.textArea}
                                placeholder="Write your review..."
                                placeholderTextColor={colors.textMuted}
                                value={reviewBody}
                                onChangeText={setReviewBody}
                                multiline
                            />
                            {reviewError && <Text style={styles.error}>{reviewError}</Text>}
                            <View style={styles.formButtons}>
                                <Touchable onPress={() => setIsReviewOpen(false)}>
                                    <Text style={styles.actionLink}>Cancel</Text>
                                </Touchable>
                                <Touchable
                                    style={styles.button}
                                    onPress={handleSubmitReview}
                                    disabled={isSubmittingReview}
                                >
                                    <Text style={styles.buttonText}>
                                        {isSubmittingReview ? "Posting..." : "Post"}
                                    </Text>
                                </Touchable>
                            </View>
                        </View>
                    )}

                    {isRecommendOpen && (
                        <View style={styles.formCard}>
                            <TextInput
                                style={styles.input}
                                placeholder="Their username"
                                placeholderTextColor={colors.textMuted}
                                value={recipientUsername}
                                onChangeText={setRecipientUsername}
                                autoCapitalize="none"
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Add a note (optional)"
                                placeholderTextColor={colors.textMuted}
                                value={recommendNote}
                                onChangeText={setRecommendNote}
                            />
                            {recommendError && <Text style={styles.error}>{recommendError}</Text>}
                            <View style={styles.formButtons}>
                                <Touchable onPress={() => setIsRecommendOpen(false)}>
                                    <Text style={styles.actionLink}>Cancel</Text>
                                </Touchable>
                                <Touchable
                                    style={styles.button}
                                    onPress={handleSendRecommendation}
                                    disabled={isSendingRecommendation}
                                >
                                    <Text style={styles.buttonText}>
                                        {isSendingRecommendation ? "Sending..." : "Send"}
                                    </Text>
                                </Touchable>
                            </View>
                        </View>
                    )}

                    {reviews.length > 0 && (
                        <View style={styles.reviewsSection}>
                            <Text style={styles.sectionTitle}>Reviews</Text>
                            {reviews.map((review) => (
                                <View key={review.id} style={styles.reviewCard}>
                                    <View style={styles.reviewHeader}>
                                        <Touchable onPress={() => router.push(`/profile/${review.username}`)}>
                                            <Text style={styles.reviewAuthor}>
                                                {review.display_name ?? review.username}
                                            </Text>
                                        </Touchable>
                                        {review.score !== null && (
                                            <View style={styles.reviewScorePill}>
                                                <Ionicons name="star" size={11} color={colors.rating} />
                                                <Text style={styles.reviewScore}>{review.score / 2}/5</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.reviewBody}>{review.body}</Text>
                                    <Touchable
                                        style={styles.reviewLikeRow}
                                        onPress={() => handleToggleReviewLike(review)}
                                    >
                                        <Ionicons
                                            name={review.liked_by_me ? "heart" : "heart-outline"}
                                            size={16}
                                            color={review.liked_by_me ? colors.like : colors.textMuted}
                                        />
                                        {review.like_count > 0 && (
                                            <Text style={styles.reviewLikeCount}>{review.like_count}</Text>
                                        )}
                                    </Touchable>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            }
            renderItem={({ item }) => (
                <Touchable
                    style={styles.trackRow}
                    onPress={() =>
                        router.push({
                            pathname: "/song/[id]",
                            params: {
                                id: item.id,
                                albumId: album.id,
                                name: item.name,
                                artistNames: item.artists.map((a) => a.name).join(", "),
                                albumName: album.name,
                                imageUrl: album.images[0]?.url,
                            },
                        })
                    }
                >
                    <Text style={styles.trackNumber}>{item.track_number}</Text>
                    <View style={styles.trackText}>
                        <Text style={styles.trackName}>{item.name}</Text>
                        {item.artists.length > 1 && (
                            <Text style={styles.trackArtist}>
                                {item.artists.map((a) => a.name).join(", ")}
                            </Text>
                        )}
                    </View>
                    {trackRatings[item.id] && (
                        <View style={styles.trackRatingPill}>
                            <Ionicons name="star" size={10} color={colors.rating} />
                            <Text style={styles.trackRatingText}>
                                {(trackRatings[item.id]!.averageScore / 2).toFixed(1)}
                            </Text>
                        </View>
                    )}
                    <Text style={styles.trackDuration}>{formatDuration(item.duration_ms)}</Text>
                </Touchable>
            )}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
    },
    header: {
        alignItems: "center",
        padding: spacing.lg,
        gap: spacing.sm,
    },
    topBar: {
        width: "100%",
        alignItems: "flex-start",
        marginBottom: spacing.xs,
    },
    cover: {
        width: 220,
        height: 220,
        borderRadius: radius.md,
        marginBottom: spacing.sm,
        ...cardShadow,
    },
    title: {
        color: colors.text,
        fontSize: 24,
        fontFamily: fonts.displayBold,
        textAlign: "center",
        letterSpacing: 0.2,
    },
    artist: {
        color: colors.textMuted,
        fontSize: 16,
        fontWeight: "500",
    },
    meta: {
        color: colors.textMuted,
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    statsCard: {
        flexDirection: "row",
        width: "100%",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.md,
        marginTop: spacing.sm,
    },
    statColumn: {
        flex: 1,
        alignItems: "center",
        gap: 2,
    },
    statDivider: {
        width: StyleSheet.hairlineWidth,
        alignSelf: "stretch",
        backgroundColor: colors.border,
    },
    statValueRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    statNumber: {
        color: colors.text,
        fontSize: 18,
        fontWeight: "700",
    },
    statNumberMuted: {
        color: colors.textMuted,
        fontSize: 15,
        fontWeight: "500",
    },
    statLabel: {
        color: colors.textMuted,
        fontSize: 11,
    },
    yourRatingPill: {
        backgroundColor: colors.ratingMuted,
        borderRadius: radius.pill,
        paddingVertical: 3,
        paddingHorizontal: spacing.sm,
    },
    actionRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.md,
        marginTop: spacing.sm,
    },
    actionButton: {
        width: 48,
        height: 48,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: "center",
        alignItems: "center",
    },
    confirmText: {
        color: colors.accent,
        fontSize: 12,
    },
    ratingModalBackdrop: {
        flex: 1,
        backgroundColor: "#00000099",
    },
    ratingModalCenter: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: spacing.xl,
    },
    ratingModalCard: {
        width: "100%",
        alignItems: "center",
        gap: spacing.md,
        backgroundColor: colors.surfaceRaised,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        ...cardShadow,
    },
    ratingModalTitle: {
        color: colors.text,
        fontSize: 17,
        fontFamily: fonts.displaySemiBold,
    },
    menuBackdrop: {
        flex: 1,
        backgroundColor: "#00000099",
    },
    menuSheet: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.surfaceRaised,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        paddingVertical: spacing.sm,
        paddingBottom: spacing.lg,
    },
    menuRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
    },
    menuRowText: {
        color: colors.text,
        fontSize: 15,
    },
    actionLink: {
        color: colors.accent,
        marginTop: spacing.xs,
        fontWeight: "600",
    },
    formCard: {
        width: "100%",
        gap: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        padding: 10,
        backgroundColor: colors.surfaceRaised,
        color: colors.text,
    },
    textArea: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        padding: 10,
        backgroundColor: colors.surfaceRaised,
        color: colors.text,
        minHeight: 80,
        textAlignVertical: "top",
    },
    formButtons: {
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: spacing.md,
    },
    button: {
        backgroundColor: colors.accent,
        borderRadius: radius.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
    },
    buttonText: {
        color: colors.text,
        fontWeight: "600",
    },
    trackRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    trackNumber: {
        color: colors.textMuted,
        width: 24,
        textAlign: "right",
    },
    trackText: {
        flex: 1,
    },
    trackName: {
        color: colors.text,
        fontWeight: "500",
    },
    trackArtist: {
        color: colors.textMuted,
        fontSize: 12,
    },
    trackDuration: {
        color: colors.textMuted,
    },
    trackRatingPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
    },
    trackRatingText: {
        color: colors.textMuted,
        fontSize: 12,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 16,
        fontFamily: fonts.displaySemiBold,
        alignSelf: "flex-start",
        marginTop: spacing.xs,
    },
    reviewsSection: {
        width: "100%",
        gap: spacing.sm,
    },
    reviewCard: {
        width: "100%",
        gap: spacing.xs,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        ...cardShadow,
        shadowOpacity: 0.15,
    },
    reviewHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    reviewAuthor: {
        color: colors.accent,
        fontWeight: "600",
    },
    reviewScorePill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: colors.ratingMuted,
        borderRadius: radius.pill,
        paddingVertical: 2,
        paddingHorizontal: 8,
    },
    reviewScore: {
        color: colors.text,
        fontSize: 12,
        fontWeight: "600",
    },
    reviewBody: {
        color: colors.text,
        fontSize: 14,
        textAlign: "left",
    },
    reviewLikeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        alignSelf: "flex-start",
    },
    reviewLikeCount: {
        color: colors.textMuted,
        fontSize: 12,
    },
    error: {
        color: colors.error,
    },
});
