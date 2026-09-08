import { useCallback, useState } from "react";
import {
    View,
    Text,
    Image,
    ScrollView,
    Pressable,
    TextInput,
    StyleSheet,
    ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useFocusEffect, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../context/AuthContext";
import { apiFetch, ApiError } from "../../api/client";
import { colors } from "../../constants/theme";

interface Profile {
    id: number;
    username: string;
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    followerCount: number;
    followingCount: number;
    isFollowing: boolean | null;
}

interface FavoriteAlbum {
    position: number;
    spotify_id: string;
    title: string;
    cover_url: string | null;
}

interface ListSummary {
    id: number;
    title: string;
    description: string | null;
    is_ranked: boolean;
    is_public: boolean;
    item_count: number;
}

interface ActivityEntity {
    entity_type: "album" | "song";
    entity_name: string | null;
    spotify_id: string | null;
    album_spotify_id: string | null;
}

interface ReviewItem extends ActivityEntity {
    id: number;
    body: string;
    score: number | null;
    created_at: string;
}

interface SpinItem extends ActivityEntity {
    id: number;
    listened_on: string;
    created_at: string;
}

function goToEntity(item: ActivityEntity) {
    if (item.entity_type === "album" && item.spotify_id) {
        router.push(`/album/${item.spotify_id}`);
    } else if (item.album_spotify_id) {
        router.push(`/album/${item.album_spotify_id}`);
    }
}

export default function ProfileScreen() {
    const { username } = useLocalSearchParams<{ username: string }>();
    const { user } = useAuth();
    const isOwnProfile = user?.username === username;

    const [profile, setProfile] = useState<Profile | null>(null);
    const [favorites, setFavorites] = useState<FavoriteAlbum[]>([]);
    const [lists, setLists] = useState<ListSummary[]>([]);
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [spins, setSpins] = useState<SpinItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
    const [followError, setFollowError] = useState<string | null>(null);

    const [isEditing, setIsEditing] = useState(false);
    const [displayNameInput, setDisplayNameInput] = useState("");
    const [bioInput, setBioInput] = useState("");
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [avatarError, setAvatarError] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            (async () => {
                setError(null);
                try {
                    const [profileData, favoritesData, listsData, reviewsData, spinsData] =
                        await Promise.all([
                            apiFetch<Profile>(`/users/${username}`),
                            apiFetch<FavoriteAlbum[]>(`/favorites/${username}`),
                            apiFetch<ListSummary[]>(`/lists/user/${username}`),
                            apiFetch<ReviewItem[]>(`/reviews/${username}`),
                            apiFetch<SpinItem[]>(`/spins/${username}`),
                        ]);
                    if (cancelled) return;
                    setProfile(profileData);
                    setIsFollowing(profileData.isFollowing);
                    setDisplayNameInput(profileData.display_name ?? "");
                    setBioInput(profileData.bio ?? "");
                    setFavorites(favoritesData);
                    setLists(listsData);
                    setReviews(reviewsData);
                    setSpins(spinsData);
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
        }, [username])
    );

    async function handleToggleFollow() {
        if (isFollowing === null) return;
        setFollowError(null);
        const next = !isFollowing;
        setIsFollowing(next);
        setProfile((p) => (p ? { ...p, followerCount: p.followerCount + (next ? 1 : -1) } : p));
        try {
            await apiFetch(`/follows/${username}`, { method: next ? "POST" : "DELETE" });
        } catch (err) {
            setIsFollowing(!next);
            setProfile((p) =>
                p ? { ...p, followerCount: p.followerCount + (next ? -1 : 1) } : p
            );
            setFollowError(err instanceof ApiError ? err.message : "Something went wrong");
        }
    }

    async function handleRemoveFavorite(position: number) {
        const previous = favorites;
        setFavorites((prev) => prev.filter((f) => f.position !== position));
        try {
            await apiFetch(`/favorites/albums/${position}`, { method: "DELETE" });
        } catch {
            setFavorites(previous);
        }
    }

    async function handlePickAvatar() {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== "granted") {
            setAvatarError("Permission to access photos is required");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: "images",
            quality: 0.7,
            base64: true,
            allowsEditing: true,
            aspect: [1, 1],
        });
        if (result.canceled || !result.assets[0]?.base64) return;

        setAvatarError(null);
        setIsUploadingAvatar(true);
        try {
            const dataUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
            const updated = await apiFetch<{ avatar_url: string }>("/users/me/avatar", {
                method: "POST",
                body: JSON.stringify({ image: dataUri }),
            });
            setProfile((p) => (p ? { ...p, avatar_url: updated.avatar_url } : p));
        } catch (err) {
            setAvatarError(err instanceof ApiError ? err.message : "Something went wrong");
        } finally {
            setIsUploadingAvatar(false);
        }
    }

    async function handleSaveProfile() {
        setSaveError(null);
        setIsSavingProfile(true);
        try {
            const updated = await apiFetch<{ display_name: string | null; bio: string | null }>(
                "/users/me",
                {
                    method: "PATCH",
                    body: JSON.stringify({ displayName: displayNameInput, bio: bioInput }),
                }
            );
            setProfile((p) =>
                p ? { ...p, display_name: updated.display_name, bio: updated.bio } : p
            );
            setIsEditing(false);
        } catch (err) {
            setSaveError(err instanceof ApiError ? err.message : "Something went wrong");
        } finally {
            setIsSavingProfile(false);
        }
    }

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={colors.accent} />
            </View>
        );
    }

    if (error || !profile) {
        return (
            <View style={styles.centered}>
                <Text style={styles.error}>{error ?? "User not found"}</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Pressable
                onPress={isOwnProfile ? handlePickAvatar : undefined}
                disabled={!isOwnProfile || isUploadingAvatar}
            >
                {profile.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitial}>
                            {(profile.display_name ?? profile.username)[0].toUpperCase()}
                        </Text>
                    </View>
                )}
                {isOwnProfile && (
                    <View style={styles.avatarBadge}>
                        {isUploadingAvatar ? (
                            <ActivityIndicator size="small" color={colors.text} />
                        ) : (
                            <Text style={styles.avatarBadgeText}>Edit</Text>
                        )}
                    </View>
                )}
            </Pressable>
            {avatarError && <Text style={styles.error}>{avatarError}</Text>}

            {!isEditing ? (
                <>
                    <Text style={styles.displayName}>{profile.display_name ?? profile.username}</Text>
                    <Text style={styles.username}>@{profile.username}</Text>
                    {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
                </>
            ) : (
                <View style={styles.form}>
                    <TextInput
                        style={styles.input}
                        placeholder="Display name"
                        placeholderTextColor={colors.textMuted}
                        value={displayNameInput}
                        onChangeText={setDisplayNameInput}
                        maxLength={50}
                    />
                    <TextInput
                        style={styles.textArea}
                        placeholder="Bio"
                        placeholderTextColor={colors.textMuted}
                        value={bioInput}
                        onChangeText={setBioInput}
                        multiline
                        maxLength={160}
                    />
                    {saveError && <Text style={styles.error}>{saveError}</Text>}
                    <View style={styles.formButtons}>
                        <Pressable onPress={() => setIsEditing(false)}>
                            <Text style={styles.actionLink}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            style={styles.button}
                            onPress={handleSaveProfile}
                            disabled={isSavingProfile}
                        >
                            <Text style={styles.buttonText}>
                                {isSavingProfile ? "Saving..." : "Save"}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            )}

            <View style={styles.statsRow}>
                <Pressable
                    onPress={() =>
                        router.push({
                            pathname: "/follows/[username]",
                            params: { username, tab: "followers" },
                        })
                    }
                >
                    <Text style={styles.stat}>
                        <Text style={styles.statNumber}>{profile.followerCount}</Text> followers
                    </Text>
                </Pressable>
                <Pressable
                    onPress={() =>
                        router.push({
                            pathname: "/follows/[username]",
                            params: { username, tab: "following" },
                        })
                    }
                >
                    <Text style={styles.stat}>
                        <Text style={styles.statNumber}>{profile.followingCount}</Text> following
                    </Text>
                </Pressable>
            </View>

            {isOwnProfile && !isEditing && (
                <View style={styles.ownProfileLinks}>
                    <Pressable onPress={() => setIsEditing(true)}>
                        <Text style={styles.actionLink}>Edit profile</Text>
                    </Pressable>
                    <Pressable onPress={() => router.push("/activity")}>
                        <Text style={styles.actionLink}>My activity</Text>
                    </Pressable>
                </View>
            )}

            {!isOwnProfile && isFollowing !== null && (
                <Pressable
                    style={[styles.button, isFollowing && styles.buttonOutline]}
                    onPress={handleToggleFollow}
                >
                    <Text style={[styles.buttonText, isFollowing && styles.buttonTextOutline]}>
                        {isFollowing ? "Following" : "Follow"}
                    </Text>
                </Pressable>
            )}
            {followError && <Text style={styles.error}>{followError}</Text>}

            <Text style={styles.sectionTitle}>Favorites</Text>
            <View style={styles.favoritesGrid}>
                {[1, 2, 3, 4].map((position) => {
                    const favorite = favorites.find((f) => f.position === position);

                    function handlePress() {
                        if (isOwnProfile) {
                            router.push({
                                pathname: "/favorites/pick",
                                params: { position: String(position) },
                            });
                        } else if (favorite) {
                            router.push(`/album/${favorite.spotify_id}`);
                        }
                    }

                    return (
                        <Pressable
                            key={position}
                            style={styles.favoriteSlot}
                            disabled={!isOwnProfile && !favorite}
                            onPress={handlePress}
                        >
                            {favorite?.cover_url ? (
                                <Image source={{ uri: favorite.cover_url }} style={styles.favoriteCover} />
                            ) : (
                                <View style={styles.favoriteEmpty} />
                            )}
                            {isOwnProfile && favorite && (
                                <Pressable
                                    style={styles.favoriteRemove}
                                    onPress={() => handleRemoveFavorite(position)}
                                    hitSlop={8}
                                >
                                    <Text style={styles.favoriteRemoveText}>✕</Text>
                                </Pressable>
                            )}
                        </Pressable>
                    );
                })}
            </View>

            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, styles.noMarginTop]}>Lists</Text>
                {isOwnProfile && (
                    <Pressable onPress={() => router.push("/lists/new")}>
                        <Text style={styles.actionLink}>+ New list</Text>
                    </Pressable>
                )}
            </View>
            {lists.length === 0 && <Text style={styles.emptyText}>No lists yet.</Text>}
            {lists.map((list) => (
                <Pressable
                    key={list.id}
                    style={styles.activityRow}
                    onPress={() => router.push(`/lists/${list.id}`)}
                >
                    <Text style={styles.activityTitle}>{list.title}</Text>
                    <Text style={styles.activityMeta}>
                        {list.item_count} {list.item_count === 1 ? "album" : "albums"}
                        {list.is_ranked ? " · Ranked" : ""}
                        {!list.is_public ? " · Private" : ""}
                    </Text>
                </Pressable>
            ))}

            <Text style={styles.sectionTitle}>Recent reviews</Text>
            {reviews.length === 0 && <Text style={styles.emptyText}>No reviews yet.</Text>}
            {reviews.map((review) => (
                <Pressable key={review.id} style={styles.activityRow} onPress={() => goToEntity(review)}>
                    <Text style={styles.activityTitle}>{review.entity_name ?? "Unknown"}</Text>
                    {review.score !== null && (
                        <Text style={styles.activityMeta}>Rated {review.score / 2}/5</Text>
                    )}
                    <Text style={styles.activityBody} numberOfLines={2}>
                        {review.body}
                    </Text>
                </Pressable>
            ))}

            <Text style={styles.sectionTitle}>Recently logged</Text>
            {spins.length === 0 && <Text style={styles.emptyText}>Nothing logged yet.</Text>}
            {spins.map((spin) => (
                <Pressable key={spin.id} style={styles.activityRow} onPress={() => goToEntity(spin)}>
                    <Text style={styles.activityTitle}>{spin.entity_name ?? "Unknown"}</Text>
                    <Text style={styles.activityMeta}>
                        {new Date(spin.listened_on).toLocaleDateString()}
                    </Text>
                </Pressable>
            ))}
        </ScrollView>
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
    content: {
        alignItems: "center",
        padding: 24,
        gap: 8,
    },
    avatar: {
        width: 88,
        height: 88,
        borderRadius: 44,
        marginBottom: 8,
    },
    avatarPlaceholder: {
        width: 88,
        height: 88,
        borderRadius: 44,
        marginBottom: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: "center",
        alignItems: "center",
    },
    avatarBadge: {
        position: "absolute",
        bottom: 8,
        alignSelf: "center",
        backgroundColor: colors.accent,
        borderRadius: 10,
        paddingVertical: 2,
        paddingHorizontal: 8,
    },
    avatarBadgeText: {
        color: colors.text,
        fontSize: 11,
        fontWeight: "600",
    },
    avatarInitial: {
        color: colors.textMuted,
        fontSize: 32,
        fontWeight: "700",
    },
    displayName: {
        color: colors.text,
        fontSize: 20,
        fontWeight: "700",
    },
    username: {
        color: colors.textMuted,
        fontSize: 14,
    },
    bio: {
        color: colors.text,
        fontSize: 14,
        textAlign: "center",
        marginTop: 4,
    },
    statsRow: {
        flexDirection: "row",
        gap: 20,
        marginTop: 8,
    },
    stat: {
        color: colors.textMuted,
    },
    statNumber: {
        color: colors.text,
        fontWeight: "700",
    },
    actionLink: {
        color: colors.accent,
        marginTop: 4,
    },
    ownProfileLinks: {
        flexDirection: "row",
        gap: 20,
    },
    button: {
        backgroundColor: colors.accent,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 24,
        marginTop: 4,
    },
    buttonOutline: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: colors.accent,
    },
    buttonText: {
        color: colors.text,
        fontWeight: "600",
    },
    buttonTextOutline: {
        color: colors.accent,
    },
    form: {
        width: "100%",
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
    formButtons: {
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 16,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: "700",
        alignSelf: "flex-start",
        marginTop: 20,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        marginTop: 20,
    },
    noMarginTop: {
        marginTop: 0,
    },
    favoritesGrid: {
        flexDirection: "row",
        gap: 8,
        width: "100%",
    },
    favoriteSlot: {
        flex: 1,
        aspectRatio: 1,
        position: "relative",
    },
    favoriteRemove: {
        position: "absolute",
        top: -6,
        right: -6,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: "center",
        alignItems: "center",
    },
    favoriteRemoveText: {
        color: colors.textMuted,
        fontSize: 11,
        lineHeight: 12,
    },
    favoriteCover: {
        width: "100%",
        height: "100%",
        borderRadius: 6,
    },
    favoriteEmpty: {
        width: "100%",
        height: "100%",
        borderRadius: 6,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: "dashed",
    },
    activityRow: {
        width: "100%",
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    activityTitle: {
        color: colors.text,
        fontWeight: "600",
    },
    activityMeta: {
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
    activityBody: {
        color: colors.textMuted,
        fontSize: 13,
        marginTop: 4,
    },
    emptyText: {
        color: colors.textMuted,
        alignSelf: "flex-start",
    },
    error: {
        color: colors.error,
    },
});
