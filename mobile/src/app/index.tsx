import { useCallback, useState } from "react";
import { View, Text, Image, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { Redirect, useFocusEffect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { apiFetch, ApiError } from "../api/client";
import { colors, spacing, radius, fonts } from "../constants/theme";
import { Touchable } from "../components/Touchable";

const LIMIT = 20;

interface FeedItem {
    activity_type: "rating" | "review" | "like" | "spin" | "follow";
    user_id: number;
    username: string;
    display_name: string | null;
    entity_type: "album" | "song" | "user";
    entity_id: number;
    reference_id: number | null;
    entity_name: string | null;
    spotify_id: string | null;
    album_spotify_id: string | null;
    score: number | null;
    body: string | null;
    created_at: string;
}

interface PopularReview {
    id: number;
    entity_type: "album" | "song";
    body: string;
    created_at: string;
    score: number | null;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    entity_name: string | null;
    cover_url: string | null;
    spotify_id: string | null;
    album_spotify_id: string | null;
    like_count: number;
    liked_by_me: boolean;
}

interface PopularAlbum {
    spotifyId: string;
    title: string;
    coverUrl: string | null;
    averageScore: number;
    ratingCount: number;
}

const ACTIVITY_ICONS: Record<FeedItem["activity_type"], keyof typeof Ionicons.glyphMap> = {
    rating: "star",
    review: "create-outline",
    like: "heart",
    spin: "play-circle-outline",
    follow: "person-add-outline",
};

function activityIconColor(type: FeedItem["activity_type"]): string {
    if (type === "rating") return colors.rating;
    if (type === "like") return colors.like;
    return colors.accent;
}

function describeActivity(item: FeedItem): string {
    const entity = item.entity_name ?? "something";
    switch (item.activity_type) {
        case "rating":
            return `rated ${entity}${item.score !== null ? ` ${item.score / 2}/5` : ""}`;
        case "review":
            return `reviewed ${entity}`;
        case "like":
            return `liked ${entity}`;
        case "spin":
            return `logged ${entity}`;
        case "follow":
            return `followed ${entity}`;
    }
}

function goToFeedEntity(item: FeedItem) {
    if (item.activity_type === "follow") {
        if (item.entity_name) router.push(`/profile/${item.entity_name}`);
        return;
    }
    goToReviewEntity(item);
}

function goToReviewEntity(item: { entity_type: "album" | "song" | "user"; spotify_id: string | null; album_spotify_id: string | null }) {
    if (item.entity_type === "album" && item.spotify_id) {
        router.push(`/album/${item.spotify_id}`);
    } else if (item.album_spotify_id) {
        router.push(`/album/${item.album_spotify_id}`);
    }
}

export default function HomeScreen() {
    const { user, logout } = useAuth();
    const [items, setItems] = useState<FeedItem[]>([]);
    const [popular, setPopular] = useState<PopularReview[]>([]);
    const [popularAlbums, setPopularAlbums] = useState<PopularAlbum[]>([]);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            (async () => {
                setIsLoading(true);
                setError(null);
                try {
                    const [feedData, popularData, popularAlbumsData] = await Promise.all([
                        apiFetch<FeedItem[]>(`/feed?limit=${LIMIT}&offset=0`),
                        apiFetch<PopularReview[]>(`/reviews/popular?limit=5`),
                        apiFetch<PopularAlbum[]>(`/ratings/popular-albums?limit=10`),
                    ]);
                    if (cancelled) return;
                    setItems(feedData);
                    setOffset(feedData.length);
                    setHasMore(feedData.length === LIMIT);
                    setPopular(popularData);
                    setPopularAlbums(popularAlbumsData);
                } catch (err) {
                    if (!cancelled) {
                        setError(err instanceof ApiError ? err.message : "Something went wrong");
                    }
                } finally {
                    if (!cancelled) setIsLoading(false);
                }
            })();
            return () => {
                cancelled = true;
            };
        }, [])
    );

    async function handleLoadMore() {
        if (isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
        try {
            const data = await apiFetch<FeedItem[]>(`/feed?limit=${LIMIT}&offset=${offset}`);
            setItems((prev) => [...prev, ...data]);
            setOffset((prev) => prev + data.length);
            setHasMore(data.length === LIMIT);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong");
        } finally {
            setIsLoadingMore(false);
        }
    }

    if (!user) {
        return <Redirect href="/login" />;
    }

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={colors.accent} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.brand}>Spun</Text>
                <View style={styles.headerLinks}>
                    <Touchable style={styles.headerIcon} onPress={() => router.push("/search")}>
                        <Ionicons name="search" size={18} color={colors.text} />
                    </Touchable>
                    <Touchable
                        style={styles.headerIcon}
                        onPress={() => router.push(`/profile/${user.username}`)}
                    >
                        <Ionicons name="person-outline" size={18} color={colors.text} />
                    </Touchable>
                    <Touchable style={styles.headerIcon} onPress={() => router.push("/recommendations")}>
                        <Ionicons name="mail-outline" size={18} color={colors.text} />
                    </Touchable>
                    <Touchable style={styles.headerIcon} onPress={logout}>
                        <Ionicons name="log-out-outline" size={18} color={colors.textMuted} />
                    </Touchable>
                </View>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <FlatList
                data={items}
                keyExtractor={(item, index) => `${item.activity_type}-${item.reference_id}-${index}`}
                ListHeaderComponent={
                    <View>
                        <Text style={styles.sectionTitle}>Popular Albums</Text>
                        {popularAlbums.length > 0 ? (
                            <FlatList
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                data={popularAlbums}
                                keyExtractor={(album) => album.spotifyId}
                                style={styles.popularAlbumsRow}
                                contentContainerStyle={styles.popularAlbumsContent}
                                renderItem={({ item }) => (
                                    <Touchable
                                        style={styles.albumCard}
                                        onPress={() => router.push(`/album/${item.spotifyId}`)}
                                    >
                                        {item.coverUrl ? (
                                            <Image source={{ uri: item.coverUrl }} style={styles.albumCover} />
                                        ) : (
                                            <View style={styles.albumCover} />
                                        )}
                                        <Text style={styles.albumTitle} numberOfLines={1}>
                                            {item.title}
                                        </Text>
                                        <View style={styles.scorePill}>
                                            <Ionicons name="star" size={10} color={colors.rating} />
                                            <Text style={styles.scorePillText}>
                                                {(item.averageScore / 2).toFixed(1)}
                                            </Text>
                                        </View>
                                    </Touchable>
                                )}
                            />
                        ) : (
                            <Text style={styles.emptySectionText}>
                                No ratings yet — rate an album to get this started.
                            </Text>
                        )}

                        <Text style={styles.sectionTitle}>Popular Reviews</Text>
                        {popular.length > 0 ? (
                            <View style={styles.popularSection}>
                                {popular.map((review) => (
                                    <Touchable
                                        key={review.id}
                                        style={styles.popularCard}
                                        onPress={() => goToReviewEntity(review)}
                                    >
                                        {review.cover_url ? (
                                            <Image
                                                source={{ uri: review.cover_url }}
                                                style={styles.popularCover}
                                            />
                                        ) : (
                                            <View style={styles.popularCover} />
                                        )}
                                        <View style={styles.popularText}>
                                            <View style={styles.popularTitleRow}>
                                                <Text style={styles.popularEntity} numberOfLines={1}>
                                                    {review.entity_name ?? "Unknown"}
                                                </Text>
                                                {review.score !== null && (
                                                    <View style={styles.scorePill}>
                                                        <Ionicons name="star" size={10} color={colors.rating} />
                                                        <Text style={styles.scorePillText}>
                                                            {review.score / 2}/5
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.popularAuthor}>
                                                by {review.display_name ?? review.username}
                                            </Text>
                                            <Text style={styles.popularBody} numberOfLines={2}>
                                                {review.body}
                                            </Text>
                                            <View style={styles.popularLikeRow}>
                                                <Ionicons name="heart" size={12} color={colors.like} />
                                                <Text style={styles.popularLikeCount}>{review.like_count}</Text>
                                            </View>
                                        </View>
                                    </Touchable>
                                ))}
                            </View>
                        ) : (
                            <Text style={styles.emptySectionText}>
                                No reviews yet — be the first to write one.
                            </Text>
                        )}

                        <Text style={[styles.sectionTitle, styles.followingTitle]}>Following</Text>
                    </View>
                }
                ListEmptyComponent={
                    <Text style={styles.emptyText}>
                        Follow some people to see their activity here.
                    </Text>
                }
                renderItem={({ item }) => (
                    <Touchable style={styles.row} onPress={() => goToFeedEntity(item)}>
                        <View style={styles.iconWrap}>
                            <Ionicons
                                name={ACTIVITY_ICONS[item.activity_type]}
                                size={16}
                                color={activityIconColor(item.activity_type)}
                            />
                        </View>
                        <View style={styles.rowText}>
                            <Text style={styles.line}>
                                <Text
                                    style={styles.actor}
                                    onPress={() => router.push(`/profile/${item.username}`)}
                                >
                                    {item.display_name ?? item.username}
                                </Text>{" "}
                                {describeActivity(item)}
                            </Text>
                            {item.body && (
                                <Text style={styles.body} numberOfLines={2}>
                                    {item.body}
                                </Text>
                            )}
                            <Text style={styles.date}>
                                {new Date(item.created_at).toLocaleDateString()}
                            </Text>
                        </View>
                    </Touchable>
                )}
                ListFooterComponent={
                    hasMore ? (
                        <Touchable
                            style={styles.loadMore}
                            onPress={handleLoadMore}
                            disabled={isLoadingMore}
                        >
                            {isLoadingMore ? (
                                <ActivityIndicator color={colors.accent} />
                            ) : (
                                <Text style={styles.loadMoreText}>Load more</Text>
                            )}
                        </Touchable>
                    ) : null
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.md,
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    brand: {
        color: colors.text,
        fontSize: 22,
        fontFamily: fonts.displayBold,
    },
    headerLinks: {
        flexDirection: "row",
        gap: spacing.sm,
    },
    headerIcon: {
        width: 36,
        height: 36,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: "center",
        alignItems: "center",
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 15,
        fontFamily: fonts.displaySemiBold,
        marginBottom: spacing.sm,
    },
    followingTitle: {
        marginTop: spacing.xs,
    },
    emptySectionText: {
        color: colors.textMuted,
        fontSize: 13,
        marginBottom: spacing.md,
    },
    popularAlbumsRow: {
        marginBottom: spacing.md,
    },
    popularAlbumsContent: {
        gap: spacing.sm,
    },
    albumCard: {
        width: 100,
        gap: 4,
    },
    albumCover: {
        width: 100,
        height: 100,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceRaised,
    },
    albumTitle: {
        color: colors.text,
        fontSize: 12,
        fontWeight: "600",
    },
    popularSection: {
        marginBottom: spacing.sm,
    },
    popularCard: {
        flexDirection: "row",
        gap: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.sm,
        marginBottom: spacing.sm,
    },
    popularCover: {
        width: 52,
        height: 52,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceRaised,
    },
    popularText: {
        flex: 1,
        gap: 2,
    },
    popularTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    popularEntity: {
        flex: 1,
        color: colors.text,
        fontWeight: "600",
    },
    popularAuthor: {
        color: colors.textMuted,
        fontSize: 12,
    },
    popularBody: {
        color: colors.textMuted,
        fontSize: 13,
    },
    popularLikeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        marginTop: 2,
    },
    popularLikeCount: {
        color: colors.textMuted,
        fontSize: 11,
    },
    scorePill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        backgroundColor: colors.ratingMuted,
        borderRadius: radius.pill,
        paddingVertical: 1,
        paddingHorizontal: 6,
    },
    scorePillText: {
        color: colors.text,
        fontSize: 11,
        fontWeight: "600",
    },
    row: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.xs,
    },
    iconWrap: {
        width: 32,
        height: 32,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceRaised,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 2,
    },
    rowText: {
        flex: 1,
        gap: 2,
    },
    line: {
        color: colors.text,
    },
    actor: {
        color: colors.accent,
        fontWeight: "600",
    },
    body: {
        color: colors.textMuted,
        fontStyle: "italic",
        fontSize: 13,
    },
    date: {
        color: colors.textMuted,
        fontSize: 12,
    },
    emptyText: {
        color: colors.textMuted,
        textAlign: "center",
        marginTop: spacing.lg,
    },
    error: {
        color: colors.error,
        marginBottom: spacing.md,
    },
    loadMore: {
        paddingVertical: spacing.md,
        alignItems: "center",
    },
    loadMoreText: {
        color: colors.accent,
        fontWeight: "600",
    },
});
