import { useCallback, useState } from "react";
import { View, Text, Image, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { colors, spacing, radius, fonts } from "../constants/theme";
import { Touchable } from "../components/Touchable";
import { BackButton } from "../components/BackButton";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiFetch, ApiError } from "../api/client";

interface BlockedUser {
    id: number;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
}

export default function BlockedUsersScreen() {
    const [users, setUsers] = useState<BlockedUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [unblockingId, setUnblockingId] = useState<number | null>(null);

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            (async () => {
                try {
                    const data = await apiFetch<BlockedUser[]>("/blocks");
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
        }, [])
    );

    async function handleUnblock(username: string, id: number) {
        setUnblockingId(id);
        const previous = users;
        setUsers((prev) => prev.filter((u) => u.id !== id));
        try {
            await apiFetch(`/blocks/${username}`, { method: "DELETE" });
        } catch {
            setUsers(previous);
        } finally {
            setUnblockingId(null);
        }
    }

    return (
        <View style={styles.container}>
            <SafeAreaView edges={["top"]} style={styles.topBar}>
                <BackButton />
                <Text style={styles.title}>Blocked users</Text>
            </SafeAreaView>
            {isLoading ? (
                <ActivityIndicator color={colors.accent} style={styles.centered} />
            ) : error ? (
                <Text style={[styles.error, styles.centered]}>{error}</Text>
            ) : (
                <FlatList
                    contentContainerStyle={styles.list}
                    data={users}
                    keyExtractor={(item) => String(item.id)}
                    ListEmptyComponent={<Text style={styles.emptyText}>You haven't blocked anyone.</Text>}
                    renderItem={({ item }) => (
                        <View style={styles.row}>
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
                                <Text style={styles.displayName}>{item.display_name ?? item.username}</Text>
                                <Text style={styles.username}>@{item.username}</Text>
                            </View>
                            <Touchable
                                style={styles.unblockButton}
                                onPress={() => handleUnblock(item.username, item.id)}
                                disabled={unblockingId === item.id}
                            >
                                <Text style={styles.unblockButtonText}>
                                    {unblockingId === item.id ? "..." : "Unblock"}
                                </Text>
                            </Touchable>
                        </View>
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
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        padding: spacing.lg,
        paddingBottom: spacing.sm,
    },
    title: {
        color: colors.text,
        fontSize: 18,
        fontFamily: fonts.displaySemiBold,
    },
    centered: {
        marginTop: spacing.xl,
    },
    list: {
        padding: spacing.lg,
        paddingTop: spacing.xs,
        gap: spacing.sm,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.sm,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: radius.pill,
    },
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceRaised,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: "center",
        alignItems: "center",
    },
    avatarInitial: {
        color: colors.textMuted,
        fontSize: 16,
        fontFamily: fonts.displayBold,
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
    unblockButton: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.pill,
        paddingVertical: 6,
        paddingHorizontal: spacing.sm,
    },
    unblockButtonText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: "600",
    },
    emptyText: {
        color: colors.textMuted,
        textAlign: "center",
        marginTop: spacing.xl,
    },
    error: {
        color: colors.error,
        textAlign: "center",
    },
});
