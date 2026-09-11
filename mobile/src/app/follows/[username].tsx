import { useState, useCallback } from "react";
import { View, Text, Image, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useFocusEffect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, ApiError } from "../../api/client";
import { colors, spacing, radius } from "../../constants/theme";
import { Touchable } from "../../components/Touchable";
import { BackButton } from "../../components/BackButton";

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
            <View style={styles.topBar}>
                <BackButton />
            </View>
            <View style={styles.tabs}>
                {(["followers", "following"] as Tab[]).map((t) => (
                    <Touchable
                        key={t}
                        style={[styles.tab, tab === t && styles.tabActive]}
                        onPress={() => setTab(t)}
                    >
                        <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                            {t[0].toUpperCase() + t.slice(1)}
                        </Text>
                    </Touchable>
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
                        <Touchable
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
                            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                        </Touchable>
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
        padding: spacing.md,
    },
    topBar: {
        marginBottom: spacing.sm,
    },
    tabs: {
        flexDirection: "row",
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    tab: {
        paddingVertical: 6,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tabActive: {
        backgroundColor: colors.accent,
        borderColor: colors.accent,
    },
    tabText: {
        color: colors.textMuted,
        fontWeight: "600",
    },
    tabTextActive: {
        color: colors.text,
    },
    spinner: {
        marginVertical: spacing.md,
    },
    error: {
        color: colors.error,
        marginBottom: spacing.md,
    },
    emptyText: {
        color: colors.textMuted,
        textAlign: "center",
        marginTop: spacing.lg,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        gap: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.xs,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: radius.pill,
    },
    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceRaised,
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
