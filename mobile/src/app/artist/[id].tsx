import { useEffect, useState } from "react";
import { View, Text, Image, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { apiFetch, ApiError } from "../../api/client";
import { colors } from "../../constants/theme";

interface ArtistAlbum {
    id: string;
    name: string;
    images: { url: string }[];
    release_date: string;
    album_type: string;
}

interface ArtistAlbumsResponse {
    items: ArtistAlbum[];
}

export default function ArtistDetailScreen() {
    const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
    const [albums, setAlbums] = useState<ArtistAlbum[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const data = await apiFetch<ArtistAlbumsResponse>(`/catalog/artists/${id}/albums`);
                setAlbums(data.items);
            } catch (err) {
                setError(err instanceof ApiError ? err.message : "Something went wrong");
            } finally {
                setIsLoading(false);
            }
        })();
    }, [id]);

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={colors.accent} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <Text style={styles.error}>{error}</Text>
            </View>
        );
    }

    return (
        <FlatList
            style={styles.container}
            data={albums}
            keyExtractor={(album) => album.id}
            ListHeaderComponent={<Text style={styles.title}>{name ?? "Artist"}</Text>}
            renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => router.push(`/album/${item.id}`)}>
                    {item.images[0] && (
                        <Image source={{ uri: item.images[0].url }} style={styles.cover} />
                    )}
                    <View style={styles.rowText}>
                        <Text style={styles.albumName}>{item.name}</Text>
                        <Text style={styles.meta}>
                            {item.release_date?.slice(0, 4)} · {item.album_type}
                        </Text>
                    </View>
                </Pressable>
            )}
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
    title: {
        color: colors.text,
        fontSize: 22,
        fontWeight: "700",
        padding: 24,
        paddingBottom: 12,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 24,
        gap: 12,
    },
    cover: {
        width: 56,
        height: 56,
        borderRadius: 4,
    },
    rowText: {
        flex: 1,
    },
    albumName: {
        color: colors.text,
        fontWeight: "600",
    },
    meta: {
        color: colors.textMuted,
        fontSize: 12,
    },
    error: {
        color: colors.error,
    },
});
