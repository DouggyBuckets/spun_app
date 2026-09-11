import { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useFocusEffect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { apiFetch, ApiError } from "../../api/client";
import { colors, spacing, radius } from "../../constants/theme";
import { Touchable } from "../../components/Touchable";
import { BackButton } from "../../components/BackButton";

interface ListSummary {
    id: number;
    title: string;
    item_count: number;
}

export default function AddToListScreen() {
    const { albumId } = useLocalSearchParams<{ albumId: string }>();
    const { user } = useAuth();

    const [lists, setLists] = useState<ListSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
    const [addingId, setAddingId] = useState<number | null>(null);

    useFocusEffect(
        useCallback(() => {
            if (!user) return;
            let cancelled = false;
            (async () => {
                setIsLoading(true);
                setError(null);
                try {
                    const data = await apiFetch<ListSummary[]>(`/lists/user/${user.username}`);
                    if (!cancelled) setLists(data);
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
        }, [user])
    );

    async function handleAdd(listId: number) {
        setAddingId(listId);
        setError(null);
        try {
            await apiFetch(`/lists/${listId}/items/albums/${albumId}`, { method: "POST" });
            setAddedIds((prev) => new Set(prev).add(listId));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong");
        } finally {
            setAddingId(null);
        }
    }

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <BackButton />
            </View>
            <Touchable
                style={styles.newListRow}
                onPress={() => router.push({ pathname: "/lists/new", params: { albumId } })}
            >
                <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                <Text style={styles.newListText}>Create new list</Text>
            </Touchable>

            {isLoading && <ActivityIndicator color={colors.accent} style={styles.spinner} />}
            {error && <Text style={styles.error}>{error}</Text>}

            <FlatList
                data={lists}
                keyExtractor={(item) => String(item.id)}
                ListEmptyComponent={
                    !isLoading ? (
                        <Text style={styles.emptyText}>You don't have any lists yet.</Text>
                    ) : null
                }
                renderItem={({ item }) => {
                    const isAdded = addedIds.has(item.id);
                    return (
                        <Touchable
                            style={styles.row}
                            onPress={() => handleAdd(item.id)}
                            disabled={isAdded || addingId === item.id}
                        >
                            <Ionicons name="list-outline" size={18} color={colors.textMuted} />
                            <View style={styles.rowText}>
                                <Text style={styles.listTitle}>{item.title}</Text>
                                <Text style={styles.listMeta}>
                                    {item.item_count} {item.item_count === 1 ? "album" : "albums"}
                                </Text>
                            </View>
                            <Text style={[styles.status, isAdded && styles.statusAdded]}>
                                {addingId === item.id ? "Adding..." : isAdded ? "Added ✓" : "Add"}
                            </Text>
                        </Touchable>
                    );
                }}
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
    topBar: {
        marginBottom: spacing.sm,
    },
    newListRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.sm,
    },
    newListText: {
        color: colors.accent,
        fontWeight: "600",
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
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.xs,
    },
    rowText: {
        flex: 1,
    },
    listTitle: {
        color: colors.text,
        fontWeight: "600",
    },
    listMeta: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
    status: {
        color: colors.accent,
        fontWeight: "600",
    },
    statusAdded: {
        color: colors.textMuted,
    },
});
