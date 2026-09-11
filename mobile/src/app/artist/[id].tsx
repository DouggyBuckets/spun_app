import { useEffect, useState } from "react";
import { View, Text, Image, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch, ApiError } from "../../api/client";
import { colors, spacing, radius, fonts } from "../../constants/theme";
import { Touchable } from "../../components/Touchable";
import { BackButton } from "../../components/BackButton";

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
            contentContainerStyle={styles.listContent}
            data={albums}
            keyExtractor={(album) => album.id}
            ListHeaderComponent={
                <View style={styles.header}>
                    <View style={styles.topBar}>
                        <BackButton />
                    </View>
                    <View style={styles.artistIcon}>
                        <Ionicons name="mic-outline" size={28} color={colors.textMuted} />
                    </View>
                    <Text style={styles.title}>{name ?? "Artist"}</Text>
                    <Text style={styles.meta}>
                        {albums.length} {albums.length === 1 ? "release" : "releases"}
                    </Text>
                </View>
            }
            renderItem={({ item }) => (
                <Touchable style={styles.row} onPress={() => router.push(`/album/${item.id}`)}>
                    {item.images[0] ? (
                        <Image source={{ uri: item.images[0].url }} style={styles.cover} />
                    ) : (
                        <View style={styles.cover} />
                    )}
                    <View style={styles.rowText}>
                        <Text style={styles.albumName}>{item.name}</Text>
                        <Text style={styles.rowMeta}>
                            {item.release_date?.slice(0, 4)} · {item.album_type}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Touchable>
            )}
        />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    listContent: {
        padding: spacing.lg,
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
    },
    header: {
        alignItems: "center",
        gap: spacing.xs,
        marginBottom: spacing.md,
    },
    topBar: {
        width: "100%",
        alignItems: "flex-start",
        marginBottom: spacing.xs,
    },
    artistIcon: {
        width: 72,
        height: 72,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.xs,
    },
    title: {
        color: colors.text,
        fontSize: 22,
        fontFamily: fonts.displayBold,
        textAlign: "center",
    },
    meta: {
        color: colors.textMuted,
        fontSize: 13,
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
    cover: {
        width: 52,
        height: 52,
        borderRadius: radius.sm,
        backgroundColor: colors.surfaceRaised,
    },
    rowText: {
        flex: 1,
    },
    albumName: {
        color: colors.text,
        fontWeight: "600",
    },
    rowMeta: {
        color: colors.textMuted,
        fontSize: 12,
    },
    error: {
        color: colors.error,
    },
});
