import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Redirect, router } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { apiFetch, ApiError } from "../api/client";
import { colors } from "../constants/theme";

interface Recommendation {
    id: number;
    entity_type: "album" | "song";
    entity_id: number;
    entity_name: string | null;
    spotify_id: string | null;
    note: string | null;
    is_read: boolean;
    created_at: string;
    sender_username: string;
    sender_display_name: string | null;
}

export default function RecommendationsScreen() {
    const { user } = useAuth();
    const [items, setItems] = useState<Recommendation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        loadInbox();
    }, [user]);

    async function loadInbox() {
        setIsLoading(true);
        try {
            const data = await apiFetch<Recommendation[]>("/recommendations");
            setItems(data);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong");
        } finally {
            setIsLoading(false);
        }
    }

    async function handleMarkRead(id: number) {
        setItems((prev) => prev.map((r) => (r.id === id ? { ...r, is_read: true } : r)));
        try {
            await apiFetch(`/recommendations/${id}/read`, { method: "PATCH" });
        } catch {
            // non-critical — a failed mark-as-read isn't worth surfacing an error for
        }
    }

    async function handleDismiss(id: number) {
        const previous = items;
        setItems((prev) => prev.filter((r) => r.id !== id));
        try {
            await apiFetch(`/recommendations/${id}`, { method: "DELETE" });
        } catch {
            setItems(previous);
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
                keyExtractor={(item) => String(item.id)}
                ListEmptyComponent={<Text style={styles.emptyText}>No recommendations yet.</Text>}
                renderItem={({ item }) => (
                    <Pressable
                        style={styles.row}
                        onPress={() => {
                            if (!item.is_read) handleMarkRead(item.id);
                            if (item.entity_type === "album" && item.spotify_id) {
                                router.push(`/album/${item.spotify_id}`);
                            }
                        }}
                    >
                        {!item.is_read && <View style={styles.unreadDot} />}
                        <View style={styles.rowText}>
                            <Text style={styles.sender}>
                                <Text
                                    style={styles.senderLink}
                                    onPress={() => router.push(`/profile/${item.sender_username}`)}
                                >
                                    {item.sender_display_name ?? item.sender_username}
                                </Text>{" "}
                                recommended {item.entity_name ?? "something"}
                            </Text>
                            {item.note && <Text style={styles.note}>"{item.note}"</Text>}
                        </View>
                        <Pressable onPress={() => handleDismiss(item.id)}>
                            <Text style={styles.dismiss}>✕</Text>
                        </Pressable>
                    </Pressable>
                )}
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
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.accent,
        marginTop: 6,
    },
    rowText: {
        flex: 1,
    },
    sender: {
        color: colors.text,
    },
    senderLink: {
        color: colors.accent,
        fontWeight: "600",
    },
    note: {
        color: colors.textMuted,
        fontStyle: "italic",
        marginTop: 2,
    },
    dismiss: {
        color: colors.textMuted,
        padding: 4,
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
});
