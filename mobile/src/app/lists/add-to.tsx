import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useFocusEffect, router } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { apiFetch, ApiError } from "../../api/client";
import { colors } from "../../constants/theme";

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
            <Pressable
                style={styles.newListRow}
                onPress={() => router.push({ pathname: "/lists/new", params: { albumId } })}
            >
                <Text style={styles.newListText}>+ Create new list</Text>
            </Pressable>

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
                        <Pressable
                            style={styles.row}
                            onPress={() => handleAdd(item.id)}
                            disabled={isAdded || addingId === item.id}
                        >
                            <View style={styles.rowText}>
                                <Text style={styles.listTitle}>{item.title}</Text>
                                <Text style={styles.listMeta}>
                                    {item.item_count} {item.item_count === 1 ? "album" : "albums"}
                                </Text>
                            </View>
                            <Text style={[styles.status, isAdded && styles.statusAdded]}>
                                {addingId === item.id ? "Adding..." : isAdded ? "Added ✓" : "Add"}
                            </Text>
                        </Pressable>
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
        padding: 16,
    },
    newListRow: {
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        marginBottom: 8,
    },
    newListText: {
        color: colors.accent,
        fontWeight: "600",
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
        justifyContent: "space-between",
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
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
