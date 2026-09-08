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
import { Redirect, router } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { apiFetch, ApiError } from "../api/client";
import { colors } from "../constants/theme";

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

export default function Index() {
    const { user, logout } = useAuth();
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
                <Text style={styles.username}>{user.username}</Text>
                <View style={styles.headerLinks}>
                    <Pressable onPress={() => router.push("/feed")}>
                        <Text style={styles.link}>Feed</Text>
                    </Pressable>
                    <Pressable onPress={() => router.push(`/profile/${user.username}`)}>
                        <Text style={styles.link}>Profile</Text>
                    </Pressable>
                    <Pressable onPress={() => router.push("/recommendations")}>
                        <Text style={styles.link}>Inbox</Text>
                    </Pressable>
                    <Pressable onPress={logout}>
                        <Text style={styles.link}>Log out</Text>
                    </Pressable>
                </View>
            </View>

            <TextInput
                style={styles.input}
                placeholder={`Search ${searchType}...`}
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
            />

            <View style={styles.tabs}>
                {(["albums", "tracks", "artists", "users"] as SearchType[]).map((type) => (
                    <Pressable
                        key={type}
                        style={[styles.tab, searchType === type && styles.tabActive]}
                        onPress={() => handleSelectType(type)}
                    >
                        <Text style={[styles.tabText, searchType === type && styles.tabTextActive]}>
                            {type[0].toUpperCase() + type.slice(1)}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {isSearching && <ActivityIndicator color={colors.accent} style={styles.spinner} />}
            {error && <Text style={styles.error}>{error}</Text>}

            <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <Pressable
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
                        {item.imageUrl && (
                            <Image source={{ uri: item.imageUrl }} style={styles.cover} />
                        )}
                        <View style={styles.resultText}>
                            <Text style={styles.resultTitle}>{item.title}</Text>
                            <Text style={styles.resultArtist}>{item.subtitle}</Text>
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
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    headerLinks: {
        flexDirection: "row",
        gap: 16,
    },
    username: {
        color: colors.text,
        fontWeight: "600",
        fontSize: 16,
    },
    link: {
        color: colors.accent,
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
