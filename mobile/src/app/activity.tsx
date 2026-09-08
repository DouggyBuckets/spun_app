import { useCallback, useState } from "react";
import {
    View,
    Text,
    Image,
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

type Tab = "listenLater" | "spins" | "reviews";

interface EntityRef {
    entity_type: "album" | "song";
    entity_name: string | null;
    cover_url: string | null;
    spotify_id: string | null;
    album_spotify_id: string | null;
}

interface ListenLaterItem extends EntityRef {
    id: number;
    created_at: string;
}

interface SpinItem extends EntityRef {
    id: number;
    listened_on: string;
}

interface ReviewItem extends EntityRef {
    id: number;
    body: string;
    score: number | null;
}

function goToEntity(item: EntityRef) {
    if (item.entity_type === "album" && item.spotify_id) {
        router.push(`/album/${item.spotify_id}`);
    } else if (item.album_spotify_id) {
        router.push(`/album/${item.album_spotify_id}`);
    }
}

export default function ActivityScreen() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>("listenLater");

    const [listenLaterItems, setListenLaterItems] = useState<ListenLaterItem[]>([]);
    const [spinItems, setSpinItems] = useState<SpinItem[]>([]);
    const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);

    const [spinOffset, setSpinOffset] = useState(0);
    const [reviewOffset, setReviewOffset] = useState(0);
    const [spinHasMore, setSpinHasMore] = useState(true);
    const [reviewHasMore, setReviewHasMore] = useState(true);

    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            if (!user) return;
            let cancelled = false;
            (async () => {
                setIsLoading(true);
                setError(null);
                try {
                    if (activeTab === "listenLater") {
                        const data = await apiFetch<ListenLaterItem[]>("/listen-later");
                        if (!cancelled) setListenLaterItems(data);
                    } else if (activeTab === "spins") {
                        const data = await apiFetch<SpinItem[]>(
                            `/spins/${user.username}?limit=${LIMIT}&offset=0`
                        );
                        if (!cancelled) {
                            setSpinItems(data);
                            setSpinOffset(data.length);
                            setSpinHasMore(data.length === LIMIT);
                        }
                    } else {
                        const data = await apiFetch<ReviewItem[]>(
                            `/reviews/${user.username}?limit=${LIMIT}&offset=0`
                        );
                        if (!cancelled) {
                            setReviewItems(data);
                            setReviewOffset(data.length);
                            setReviewHasMore(data.length === LIMIT);
                        }
                    }
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
        }, [activeTab, user])
    );

    async function handleLoadMore() {
        if (isLoadingMore || !user) return;
        setIsLoadingMore(true);
        try {
            if (activeTab === "spins" && spinHasMore) {
                const data = await apiFetch<SpinItem[]>(
                    `/spins/${user.username}?limit=${LIMIT}&offset=${spinOffset}`
                );
                setSpinItems((prev) => [...prev, ...data]);
                setSpinOffset((prev) => prev + data.length);
                setSpinHasMore(data.length === LIMIT);
            } else if (activeTab === "reviews" && reviewHasMore) {
                const data = await apiFetch<ReviewItem[]>(
                    `/reviews/${user.username}?limit=${LIMIT}&offset=${reviewOffset}`
                );
                setReviewItems((prev) => [...prev, ...data]);
                setReviewOffset((prev) => prev + data.length);
                setReviewHasMore(data.length === LIMIT);
            }
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong");
        } finally {
            setIsLoadingMore(false);
        }
    }

    async function handleRemoveListenLater(item: ListenLaterItem) {
        const previous = listenLaterItems;
        setListenLaterItems((prev) => prev.filter((i) => i.id !== item.id));
        try {
            const path =
                item.entity_type === "album"
                    ? `/listen-later/albums/${item.spotify_id}`
                    : `/listen-later/songs/${item.spotify_id}`;
            await apiFetch(path, { method: "DELETE" });
        } catch {
            setListenLaterItems(previous);
        }
    }

    if (!user) {
        return <Redirect href="/login" />;
    }

    const loadMoreFooter = (hasMore: boolean) =>
        hasMore ? (
            <Pressable style={styles.loadMore} onPress={handleLoadMore} disabled={isLoadingMore}>
                {isLoadingMore ? (
                    <ActivityIndicator color={colors.accent} />
                ) : (
                    <Text style={styles.loadMoreText}>Load more</Text>
                )}
            </Pressable>
        ) : null;

    return (
        <View style={styles.container}>
            <View style={styles.tabs}>
                {(
                    [
                        { key: "listenLater", label: "Listen Later" },
                        { key: "spins", label: "Logged" },
                        { key: "reviews", label: "Reviews" },
                    ] as { key: Tab; label: string }[]
                ).map(({ key, label }) => (
                    <Pressable
                        key={key}
                        style={[styles.tab, activeTab === key && styles.tabActive]}
                        onPress={() => setActiveTab(key)}
                    >
                        <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>
                            {label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {isLoading && <ActivityIndicator color={colors.accent} style={styles.spinner} />}
            {error && <Text style={styles.error}>{error}</Text>}

            {!isLoading && activeTab === "listenLater" && (
                <FlatList
                    data={listenLaterItems}
                    keyExtractor={(item) => String(item.id)}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>Your Listen Later queue is empty.</Text>
                    }
                    renderItem={({ item }) => (
                        <Pressable style={styles.row} onPress={() => goToEntity(item)}>
                            {item.cover_url && (
                                <Image source={{ uri: item.cover_url }} style={styles.cover} />
                            )}
                            <Text style={styles.rowTitle}>{item.entity_name ?? "Unknown"}</Text>
                            <Pressable
                                onPress={() => handleRemoveListenLater(item)}
                                hitSlop={8}
                            >
                                <Text style={styles.remove}>✕</Text>
                            </Pressable>
                        </Pressable>
                    )}
                />
            )}

            {!isLoading && activeTab === "spins" && (
                <FlatList
                    data={spinItems}
                    keyExtractor={(item) => String(item.id)}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>Nothing logged yet.</Text>
                    }
                    renderItem={({ item }) => (
                        <Pressable style={styles.row} onPress={() => goToEntity(item)}>
                            {item.cover_url && (
                                <Image source={{ uri: item.cover_url }} style={styles.cover} />
                            )}
                            <View style={styles.rowText}>
                                <Text style={styles.rowTitle}>{item.entity_name ?? "Unknown"}</Text>
                                <Text style={styles.rowMeta}>
                                    {new Date(item.listened_on).toLocaleDateString()}
                                </Text>
                            </View>
                        </Pressable>
                    )}
                    ListFooterComponent={loadMoreFooter(spinHasMore)}
                />
            )}

            {!isLoading && activeTab === "reviews" && (
                <FlatList
                    data={reviewItems}
                    keyExtractor={(item) => String(item.id)}
                    ListEmptyComponent={<Text style={styles.emptyText}>No reviews yet.</Text>}
                    renderItem={({ item }) => (
                        <Pressable style={styles.row} onPress={() => goToEntity(item)}>
                            {item.cover_url && (
                                <Image source={{ uri: item.cover_url }} style={styles.cover} />
                            )}
                            <View style={styles.rowText}>
                                <Text style={styles.rowTitle}>{item.entity_name ?? "Unknown"}</Text>
                                {item.score !== null && (
                                    <Text style={styles.rowMeta}>Rated {item.score / 2}/5</Text>
                                )}
                                <Text style={styles.rowBody} numberOfLines={2}>
                                    {item.body}
                                </Text>
                            </View>
                        </Pressable>
                    )}
                    ListFooterComponent={loadMoreFooter(reviewHasMore)}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: 16,
    },
    tabs: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 12,
    },
    tab: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 16,
        backgroundColor: colors.surface,
    },
    tabActive: {
        backgroundColor: colors.accent,
    },
    tabText: {
        color: colors.textMuted,
        fontWeight: "600",
    },
    tabTextActive: {
        color: colors.text,
    },
    spinner: {
        marginVertical: 12,
    },
    error: {
        color: colors.error,
        marginBottom: 12,
    },
    emptyText: {
        color: colors.textMuted,
        textAlign: "center",
        marginTop: 24,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        gap: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    cover: {
        width: 48,
        height: 48,
        borderRadius: 4,
    },
    rowText: {
        flex: 1,
    },
    rowTitle: {
        flex: 1,
        color: colors.text,
        fontWeight: "600",
    },
    rowMeta: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
    rowBody: {
        color: colors.textMuted,
        fontSize: 13,
        marginTop: 4,
    },
    remove: {
        color: colors.textMuted,
        padding: 4,
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
