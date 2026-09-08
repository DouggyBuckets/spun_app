import { useState } from "react";
import { View, Text, Image, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useFocusEffect, router } from "expo-router";
import { useCallback } from "react";
import { apiFetch, ApiError } from "../../api/client";
import { colors } from "../../constants/theme";

type Tab = "followers" | "following";

interface FollowUser {
    id: number;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
}

export default function FollowsScreen() {
    const { username, tab: initialTab } = useLocalSearchParams<{
        username: string;
        tab?: Tab;
    }>();
    const [tab, setTab] = useState<Tab>(initialTab === "following" ? "following" : "followers");
    const [users, setUsers] = useState<FollowUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            (async () => {
                setIsLoading(true);
                setError(null);
                try {
                    const data = await apiFetch<FollowUser[]>(`/follows/${username}/${tab}`);
                    if (!cancelled) setUsers(data);
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
        }, [username, tab])
    );

    return (
        <View style={styles.container}>
            <View style={styles.tabs}>
                {(["followers", "following"] as Tab[]).map((t) => (
                    <Pressable
                        key={t}
                        style={[styles.tab, tab === t && styles.tabActive]}
                        onPress={() => setTab(t)}
                    >
                        <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                            {t[0].toUpperCase() + t.slice(1)}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {isLoading && <ActivityIndicator color={colors.accent} style={styles.spinner} />}
            {error && <Text style={styles.error}>{error}</Text>}

            {!isLoading && (
                <FlatList
                    data={users}
                    keyExtractor={(item) => String(item.id)}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>
                            {tab === "followers" ? "No followers yet." : "Not following anyone yet."}
                        </Text>
                    }
                    renderItem={({ item }) => (
                        <Pressable
                            style={styles.row}
                            onPress={() => router.push(`/profile/${item.username}`)}
                        >
                            {item.avatar_url ? (
                                <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <Text style={styles.avatarInitial}>
                                        {(item.display_name ?? item.username)[0].toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.rowText}>
                                <Text style={styles.displayName}>
                                    {item.display_name ?? item.username}
                                </Text>
                                <Text style={styles.username}>@{item.username}</Text>
                            </View>
                        </Pressable>
                    )}
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
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: "center",
        alignItems: "center",
    },
    avatarInitial: {
        color: colors.textMuted,
        fontWeight: "700",
    },
    rowText: {
        flex: 1,
    },
    displayName: {
        color: colors.text,
        fontWeight: "600",
    },
    username: {
        color: colors.textMuted,
        fontSize: 12,
    },
});
