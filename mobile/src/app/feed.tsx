import { useCallback, useState } from "react";
import {
    View,
    Text,
    FlatList,
    Pressable,
    StyleSheet,
    ActivityIndicator,
} from "react-native";
import { Redirect, useFocusEffect, router } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { apiFetch, ApiError } from "../api/client";
import { colors } from "../constants/theme";

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

function goToEntity(item: FeedItem) {
    if (item.activity_type === "follow") {
        if (item.entity_name) router.push(`/profile/${item.entity_name}`);
        return;
    }
    if (item.entity_type === "album" && item.spotify_id) {
        router.push(`/album/${item.spotify_id}`);
    } else if (item.album_spotify_id) {
        router.push(`/album/${item.album_spotify_id}`);
    }
}

export default function FeedScreen() {
    const { user } = useAuth();
    const [items, setItems] = useState<FeedItem[]>([]);
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
                    const data = await apiFetch<FeedItem[]>(`/feed?limit=${LIMIT}&offset=0`);
                    if (cancelled) return;
                    setItems(data);
                    setOffset(data.length);
                    setHasMore(data.length === LIMIT);
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
            {error && <Text style={styles.error}>{error}</Text>}
            <FlatList
                data={items}
                keyExtractor={(item, index) => `${item.activity_type}-${item.reference_id}-${index}`}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>
                        Follow some people to see their activity here.
                    </Text>
                }
                renderItem={({ item }) => (
                    <Pressable style={styles.row} onPress={() => goToEntity(item)}>
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
                    </Pressable>
                )}
                ListFooterComponent={
                    hasMore ? (
                        <Pressable
                            style={styles.loadMore}
                            onPress={handleLoadMore}
                            disabled={isLoadingMore}
                        >
                            {isLoadingMore ? (
                                <ActivityIndicator color={colors.accent} />
                            ) : (
                                <Text style={styles.loadMoreText}>Load more</Text>
                            )}
                        </Pressable>
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
        padding: 16,
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
    },
    row: {
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        gap: 4,
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
        marginTop: 24,
    },
    error: {
        color: colors.error,
        marginBottom: 12,
    },
    loadMore: {
        paddingVertical: 16,
        alignItems: "center",
    },
    loadMoreText: {
        color: colors.accent,
        fontWeight: "600",
    },
});
