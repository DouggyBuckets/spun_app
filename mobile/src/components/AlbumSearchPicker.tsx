import { useState } from "react";
import {
    View,
    TextInput,
    FlatList,
    Image,
    Text,
    Pressable,
    StyleSheet,
    ActivityIndicator,
} from "react-native";
import { apiFetch, ApiError } from "../api/client";
import { colors } from "../constants/theme";

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
            {isSearching && <ActivityIndicator color={colors.accent} style={styles.spinner} />}
            {error && <Text style={styles.error}>{error}</Text>}
            <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <Pressable
                        style={styles.resultRow}
                        onPress={() => handlePick(item)}
                        disabled={isSaving}
                    >
                        {item.imageUrl && (
                            <Image source={{ uri: item.imageUrl }} style={styles.cover} />
                        )}
                        <View style={styles.resultText}>
                            <Text style={styles.resultTitle}>{item.name}</Text>
                            <Text style={styles.resultArtist}>{item.artistNames}</Text>
                        </View>
                    </Pressable>
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
        padding: 16,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 12,
        backgroundColor: colors.surface,
        color: colors.text,
        marginBottom: 12,
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
    resultRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        gap: 12,
    },
    cover: {
        width: 56,
        height: 56,
        borderRadius: 4,
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
    },
});
