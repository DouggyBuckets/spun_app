import { useState } from "react";
import { View, TextInput, FlatList, Image, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, ApiError } from "../api/client";
import { colors, spacing, radius } from "../constants/theme";
import { Touchable } from "./Touchable";
import { BackButton } from "./BackButton";

export interface AlbumPickResult {
    id: string;
    name: string;
    artistNames: string;
    imageUrl: string | null;
}

interface AlbumSearchResponse {
    albums: {
        items: {
            id: string;
            name: string;
            images: { url: string }[];
            artists: { id: string; name: string }[];
        }[];
    };
}

interface AlbumSearchPickerProps {
    onPick: (album: AlbumPickResult) => Promise<void>;
}

export function AlbumSearchPicker({ onPick }: AlbumSearchPickerProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<AlbumPickResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSearch() {
        if (!query.trim()) return;
        setError(null);
        setIsSearching(true);
        try {
            const data = await apiFetch<AlbumSearchResponse>(
                `/catalog/search?query=${encodeURIComponent(query)}`
            );
            setResults(
                data.albums.items.map((album) => ({
                    id: album.id,
                    name: album.name,
                    artistNames: album.artists.map((a) => a.name).join(", "),
                    imageUrl: album.images[0]?.url ?? null,
                }))
            );
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong");
        } finally {
            setIsSearching(false);
        }
    }

    async function handlePick(album: AlbumPickResult) {
        setError(null);
        setIsSaving(true);
        try {
            await onPick(album);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong");
            setIsSaving(false);
        }
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <BackButton />
            </View>
            <View style={styles.inputRow}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                    style={styles.input}
                    placeholder="Search for an album..."
                    placeholderTextColor={colors.textMuted}
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                    autoFocus
                />
            </View>
            {isSearching && <ActivityIndicator color={colors.accent} style={styles.spinner} />}
            {error && <Text style={styles.error}>{error}</Text>}
            <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <Touchable
                        style={styles.resultRow}
                        onPress={() => handlePick(item)}
                        disabled={isSaving}
                    >
                        {item.imageUrl ? (
                            <Image source={{ uri: item.imageUrl }} style={styles.cover} />
                        ) : (
                            <View style={styles.cover} />
                        )}
                        <View style={styles.resultText}>
                            <Text style={styles.resultTitle}>{item.name}</Text>
                            <Text style={styles.resultArtist}>{item.artistNames}</Text>
                        </View>
                    </Touchable>
                )}
                ListEmptyComponent={
                    !isSearching && query ? (
                        <Text style={styles.emptyText}>No results found.</Text>
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
    header: {
        marginBottom: spacing.sm,
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.surface,
        marginBottom: spacing.sm,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
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
    resultRow: {
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
    cover: {
        width: 52,
        height: 52,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceRaised,
    },
    resultText: {
        flex: 1,
    },
    resultTitle: {
        color: colors.text,
        fontWeight: "600",
    },
    resultArtist: {
        color: colors.textMuted,
        fontSize: 13,
    },
});
