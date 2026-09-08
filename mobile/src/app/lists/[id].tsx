import { useCallback, useState } from "react";
import {
    View,
    Text,
    Image,
    FlatList,
    Pressable,
    TextInput,
    Switch,
    StyleSheet,
    ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useFocusEffect, router } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { apiFetch, ApiError } from "../../api/client";
import { colors } from "../../constants/theme";

interface ListItem {
    id: number;
    entity_type: "album";
    position: number | null;
    spotify_id: string;
    title: string;
    cover_url: string | null;
}

interface ListDetails {
    id: number;
    user_id: number;
    title: string;
    description: string | null;
    is_ranked: boolean;
    is_public: boolean;
    items: ListItem[];
}

export default function ListDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();

    const [list, setList] = useState<ListDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isEditing, setIsEditing] = useState(false);
    const [titleInput, setTitleInput] = useState("");
    const [descriptionInput, setDescriptionInput] = useState("");
    const [isRankedInput, setIsRankedInput] = useState(false);
    const [isPublicInput, setIsPublicInput] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const isOwner = list !== null && user !== null && user.id === list.user_id;

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            (async () => {
                setError(null);
                try {
                    const data = await apiFetch<ListDetails>(`/lists/${id}`);
                    if (cancelled) return;
                    setList(data);
                    setTitleInput(data.title);
                    setDescriptionInput(data.description ?? "");
                    setIsRankedInput(data.is_ranked);
                    setIsPublicInput(data.is_public);
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
        }, [id])
    );

    async function handleSave() {
        setSaveError(null);
        setIsSaving(true);
        try {
            const updated = await apiFetch<ListDetails>(`/lists/${id}`, {
                method: "PATCH",
                body: JSON.stringify({
                    title: titleInput,
                    description: descriptionInput,
                    isRanked: isRankedInput,
                    isPublic: isPublicInput,
                }),
            });
            setList((prev) => (prev ? { ...prev, ...updated } : prev));
            setIsEditing(false);
        } catch (err) {
            setSaveError(err instanceof ApiError ? err.message : "Something went wrong");
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDelete() {
        try {
            await apiFetch(`/lists/${id}`, { method: "DELETE" });
            router.back();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong");
        }
    }

    async function handleMove(index: number, direction: -1 | 1) {
        if (!list) return;
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= list.items.length) return;

        const previous = list.items;
        const items = [...list.items];
        [items[index], items[targetIndex]] = [items[targetIndex]!, items[index]!];
        setList({ ...list, items });

        try {
            await apiFetch(`/lists/${id}/items/reorder`, {
                method: "PATCH",
                body: JSON.stringify({ itemIds: items.map((item) => item.id) }),
            });
        } catch {
            setList({ ...list, items: previous });
        }
    }

    async function handleRemoveItem(spotifyId: string) {
        if (!list) return;
        const previous = list;
        setList({ ...list, items: list.items.filter((item) => item.spotify_id !== spotifyId) });
        try {
            await apiFetch(`/lists/${id}/items/albums/${spotifyId}`, { method: "DELETE" });
        } catch {
            setList(previous);
        }
    }

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={colors.accent} />
            </View>
        );
    }

    if (error || !list) {
        return (
            <View style={styles.centered}>
                <Text style={styles.error}>{error ?? "List not found"}</Text>
            </View>
        );
    }

    return (
        <FlatList
            style={styles.container}
            data={list.items}
            keyExtractor={(item) => item.spotify_id}
            ListHeaderComponent={
                <View style={styles.header}>
                    {!isEditing ? (
                        <>
                            <Text style={styles.title}>{list.title}</Text>
                            {list.description && <Text style={styles.description}>{list.description}</Text>}
                            <Text style={styles.meta}>
                                {list.is_ranked ? "Ranked" : "Unranked"} ·{" "}
                                {list.is_public ? "Public" : "Private"} · {list.items.length}{" "}
                                {list.items.length === 1 ? "album" : "albums"}
                            </Text>
                        </>
                    ) : (
                        <View style={styles.form}>
                            <TextInput
                                style={styles.input}
                                placeholder="Title"
                                placeholderTextColor={colors.textMuted}
                                value={titleInput}
                                onChangeText={setTitleInput}
                                maxLength={150}
                            />
                            <TextInput
                                style={styles.textArea}
                                placeholder="Description"
                                placeholderTextColor={colors.textMuted}
                                value={descriptionInput}
                                onChangeText={setDescriptionInput}
                                multiline
                                maxLength={2000}
                            />
                            <View style={styles.switchRow}>
                                <Text style={styles.switchLabel}>Ranked</Text>
                                <Switch value={isRankedInput} onValueChange={setIsRankedInput} />
                            </View>
                            <View style={styles.switchRow}>
                                <Text style={styles.switchLabel}>Public</Text>
                                <Switch value={isPublicInput} onValueChange={setIsPublicInput} />
                            </View>
                            {saveError && <Text style={styles.error}>{saveError}</Text>}
                            <View style={styles.formButtons}>
                                <Pressable onPress={() => setIsEditing(false)}>
                                    <Text style={styles.actionLink}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    style={styles.button}
                                    onPress={handleSave}
                                    disabled={isSaving}
                                >
                                    <Text style={styles.buttonText}>
                                        {isSaving ? "Saving..." : "Save"}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    )}

                    {isOwner && !isEditing && (
                        <View style={styles.ownerActions}>
                            <Pressable onPress={() => setIsEditing(true)}>
                                <Text style={styles.actionLink}>Edit</Text>
                            </Pressable>
                            <Pressable
                                onPress={() =>
                                    router.push({ pathname: "/lists/add-album", params: { id } })
                                }
                            >
                                <Text style={styles.actionLink}>Add album</Text>
                            </Pressable>
                            <Pressable onPress={handleDelete}>
                                <Text style={[styles.actionLink, styles.deleteLink]}>Delete</Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            }
            renderItem={({ item, index }) => (
                <Pressable
                    style={styles.itemRow}
                    onPress={() => router.push(`/album/${item.spotify_id}`)}
                >
                    {list.is_ranked && <Text style={styles.itemPosition}>{index + 1}</Text>}
                    {item.cover_url && (
                        <Image source={{ uri: item.cover_url }} style={styles.itemCover} />
                    )}
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    {isOwner && list.is_ranked && (
                        <View style={styles.moveButtons}>
                            <Pressable
                                onPress={() => handleMove(index, -1)}
                                disabled={index === 0}
                                hitSlop={8}
                            >
                                <Text
                                    style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
                                >
                                    ▲
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={() => handleMove(index, 1)}
                                disabled={index === list.items.length - 1}
                                hitSlop={8}
                            >
                                <Text
                                    style={[
                                        styles.moveButton,
                                        index === list.items.length - 1 && styles.moveButtonDisabled,
                                    ]}
                                >
                                    ▼
                                </Text>
                            </Pressable>
                        </View>
                    )}
                    {isOwner && (
                        <Pressable
                            onPress={() => handleRemoveItem(item.spotify_id)}
                            hitSlop={8}
                        >
                            <Text style={styles.itemRemove}>✕</Text>
                        </Pressable>
                    )}
                </Pressable>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No albums in this list yet.</Text>}
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
        padding: 24,
        gap: 6,
    },
    title: {
        color: colors.text,
        fontSize: 22,
        fontWeight: "700",
    },
    description: {
        color: colors.text,
        fontSize: 14,
    },
    meta: {
        color: colors.textMuted,
        fontSize: 13,
    },
    form: {
        gap: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 10,
        backgroundColor: colors.surface,
        color: colors.text,
    },
    textArea: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 10,
        backgroundColor: colors.surface,
        color: colors.text,
        minHeight: 60,
        textAlignVertical: "top",
    },
    switchRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    switchLabel: {
        color: colors.text,
    },
    formButtons: {
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 16,
    },
    button: {
        backgroundColor: colors.accent,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    buttonText: {
        color: colors.text,
        fontWeight: "600",
    },
    actionLink: {
        color: colors.accent,
    },
    deleteLink: {
        color: colors.error,
    },
    ownerActions: {
        flexDirection: "row",
        gap: 20,
        marginTop: 8,
    },
    itemRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 24,
        gap: 12,
    },
    itemPosition: {
        color: colors.textMuted,
        width: 20,
        textAlign: "right",
    },
    itemCover: {
        width: 48,
        height: 48,
        borderRadius: 4,
    },
    itemTitle: {
        flex: 1,
        color: colors.text,
    },
    itemRemove: {
        color: colors.textMuted,
        padding: 4,
    },
    moveButtons: {
        gap: 2,
    },
    moveButton: {
        color: colors.accent,
        fontSize: 12,
        textAlign: "center",
        padding: 2,
    },
    moveButtonDisabled: {
        color: colors.border,
    },
    emptyText: {
        color: colors.textMuted,
        textAlign: "center",
        marginTop: 24,
    },
    error: {
        color: colors.error,
    },
});
