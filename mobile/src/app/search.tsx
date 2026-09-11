import { useState } from "react";
import { View, TextInput, FlatList, Image, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Redirect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { apiFetch, ApiError } from "../api/client";
import { colors, spacing, radius, fonts } from "../constants/theme";
import { Touchable } from "../components/Touchable";
import { BackButton } from "../components/BackButton";

type SearchType = "albums" | "tracks" | "artists" | "users";

interface NormalizedResult {
    id: string;
    title: string;
    subtitle: string;
    imageUrl: string | null;
    type: "album" | "track" | "artist" | "user";
    albumId?: string;
    albumName?: string;
    username?: string;
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

interface TrackSearchResponse {
    tracks: {
        items: {
            id: string;
            name: string;
            artists: { id: string; name: string }[];
            album: { id: string; name: string; images: { url: string }[] };
        }[];
    };
}

interface ArtistSearchResponse {
    artists: {
        items: { id: string; name: string; images: { url: string }[] }[];
    };
}

interface UserSearchResult {
    id: number;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
}

async function searchByType(type: SearchType, query: string): Promise<NormalizedResult[]> {
    const q = encodeURIComponent(query);

    if (type === "albums") {
        const data = await apiFetch<AlbumSearchResponse>(`/catalog/search?query=${q}`);
        return data.albums.items.map((album) => ({
            id: album.id,
            title: album.name,
            subtitle: album.artists.map((a) => a.name).join(", "),
            imageUrl: album.images[0]?.url ?? null,
            type: "album" as const,
        }));
    }

    if (type === "tracks") {
        const data = await apiFetch<TrackSearchResponse>(`/catalog/search/tracks?query=${q}`);
        return data.tracks.items.map((track) => ({
            id: track.id,
            title: track.name,
            subtitle: track.artists.map((a) => a.name).join(", "),
            imageUrl: track.album.images[0]?.url ?? null,
            type: "track" as const,
            albumId: track.album.id,
            albumName: track.album.name,
        }));
    }

    if (type === "artists") {
        const data = await apiFetch<ArtistSearchResponse>(`/catalog/search/artists?query=${q}`);
        return data.artists.items.map((artist) => ({
            id: artist.id,
            title: artist.name,
            subtitle: "Artist",
            imageUrl: artist.images[0]?.url ?? null,
            type: "artist" as const,
        }));
    }

    const data = await apiFetch<UserSearchResult[]>(`/users?query=${q}`);
    return data.map((result) => ({
        id: String(result.id),
        title: result.display_name ?? result.username,
        subtitle: `@${result.username}`,
        imageUrl: result.avatar_url,
        type: "user" as const,
        username: result.username,
    }));
}

const TAB_ICONS: Record<SearchType, keyof typeof Ionicons.glyphMap> = {
    albums: "disc-outline",
    tracks: "musical-notes-outline",
    artists: "mic-outline",
    users: "people-outline",
};

export default function SearchScreen() {
    const { user } = useAuth();
    const [query, setQuery] = useState("");
    const [searchType, setSearchType] = useState<SearchType>("albums");
    const [results, setResults] = useState<NormalizedResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!user) {
        return <Redirect href="/login" />;
    }

    async function handleSearch() {
        if (!query.trim()) return;
        setError(null);
        setIsSearching(true);
        try {
            const normalized = await searchByType(searchType, query);
            setResults(normalized);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong");
        } finally {
            setIsSearching(false);
        }
    }

    function handleSelectType(type: SearchType) {
        setSearchType(type);
        setResults([]);
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <BackButton />
                <Text style={styles.headerTitle}>Search</Text>
            </View>

            <View style={styles.inputRow}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                    style={styles.input}
                    placeholder={`Search ${searchType}...`}
                    placeholderTextColor={colors.textMuted}
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                    autoFocus
                />
            </View>

            <View style={styles.tabs}>
                {(["albums", "tracks", "artists", "users"] as SearchType[]).map((type) => (
                    <Touchable
                        key={type}
                        style={[styles.tab, searchType === type && styles.tabActive]}
                        onPress={() => handleSelectType(type)}
                    >
                        <Ionicons
                            name={TAB_ICONS[type]}
                            size={14}
                            color={searchType === type ? colors.text : colors.textMuted}
                        />
                        <Text style={[styles.tabText, searchType === type && styles.tabTextActive]}>
                            {type[0].toUpperCase() + type.slice(1)}
                        </Text>
                    </Touchable>
                ))}
            </View>

            {isSearching && <ActivityIndicator color={colors.accent} style={styles.spinner} />}
            {error && <Text style={styles.error}>{error}</Text>}

            <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <Touchable
                        style={styles.resultRow}
                        onPress={() => {
                            if (item.type === "album") {
                                router.push(`/album/${item.id}`);
                            } else if (item.type === "track") {
                                router.push({
                                    pathname: "/song/[id]",
                                    params: {
                                        id: item.id,
                                        albumId: item.albumId!,
                                        name: item.title,
                                        artistNames: item.subtitle,
                                        albumName: item.albumName!,
                                        imageUrl: item.imageUrl ?? undefined,
                                    },
                                });
                            } else if (item.type === "artist") {
                                router.push({
                                    pathname: "/artist/[id]",
                                    params: { id: item.id, name: item.title },
                                });
                            } else {
                                router.push(`/profile/${item.username}`);
                            }
                        }}
                    >
                        {item.imageUrl ? (
                            <Image
                                source={{ uri: item.imageUrl }}
                                style={[styles.cover, item.type === "user" && styles.coverRound]}
                            />
                        ) : item.type === "user" ? (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarInitial}>
                                    {item.title[0]?.toUpperCase()}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.cover} />
                        )}
                        <View style={styles.resultText}>
                            <Text style={styles.resultTitle}>{item.title}</Text>
                            <Text style={styles.resultArtist}>{item.subtitle}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
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
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    headerTitle: {
        color: colors.text,
        fontFamily: fonts.displaySemiBold,
        fontSize: 18,
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
    tabs: {
        flexDirection: "row",
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    tab: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: spacing.sm,
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
        fontSize: 13,
    },
    tabTextActive: {
        color: colors.text,
    },
    spinner: {
        marginVertical: spacing.sm,
    },
    error: {
        color: colors.error,
        marginBottom: spacing.sm,
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
    coverRound: {
        borderRadius: radius.pill,
    },
    avatarPlaceholder: {
        width: 52,
        height: 52,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceRaised,
        justifyContent: "center",
        alignItems: "center",
    },
    avatarInitial: {
        color: colors.textMuted,
        fontSize: 18,
        fontWeight: "700",
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
