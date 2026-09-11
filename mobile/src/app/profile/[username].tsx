import { useCallback, useState } from "react";
import {
    View,
    Text,
    Image,
    ScrollView,
    TextInput,
    StyleSheet,
    ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useFocusEffect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../context/AuthContext";
import { apiFetch, ApiError } from "../../api/client";
import { colors, spacing, radius, cardShadow, fonts } from "../../constants/theme";
import { Touchable } from "../../components/Touchable";
import { BackButton } from "../../components/BackButton";

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
            <View style={styles.topBar}>
                <BackButton />
            </View>
            <Touchable
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
                            <Ionicons name="pencil" size={12} color={colors.text} />
                        )}
                    </View>
                )}
            </Touchable>
            {avatarError && <Text style={styles.error}>{avatarError}</Text>}

            {!isEditing ? (
                <>
                    <Text style={styles.displayName}>{profile.display_name ?? profile.username}</Text>
                    <Text style={styles.username}>@{profile.username}</Text>
                    {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
                </>
            ) : (
                <View style={styles.formCard}>
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
                        <Touchable onPress={() => setIsEditing(false)}>
                            <Text style={styles.actionLink}>Cancel</Text>
                        </Touchable>
                        <Touchable
                            style={styles.button}
                            onPress={handleSaveProfile}
                            disabled={isSavingProfile}
                        >
                            <Text style={styles.buttonText}>
                                {isSavingProfile ? "Saving..." : "Save"}
                            </Text>
                        </Touchable>
                    </View>
                </View>
            )}

            <View style={styles.statsRow}>
                <Touchable
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
                </Touchable>
                <Touchable
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
                </Touchable>
            </View>

            {isOwnProfile && !isEditing && (
                <View style={styles.ownProfileLinks}>
                    <Touchable style={styles.pillLink} onPress={() => setIsEditing(true)}>
                        <Ionicons name="create-outline" size={14} color={colors.accent} />
                        <Text style={styles.actionLink}>Edit profile</Text>
                    </Touchable>
                    <Touchable style={styles.pillLink} onPress={() => router.push("/activity")}>
                        <Ionicons name="time-outline" size={14} color={colors.accent} />
                        <Text style={styles.actionLink}>My activity</Text>
                    </Touchable>
                </View>
            )}

            {!isOwnProfile && isFollowing !== null && (
                <Touchable
                    style={[styles.button, isFollowing && styles.buttonOutline]}
                    onPress={handleToggleFollow}
                >
                    <Text style={[styles.buttonText, isFollowing && styles.buttonTextOutline]}>
                        {isFollowing ? "Following" : "Follow"}
                    </Text>
                </Touchable>
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
                        <Touchable
                            key={position}
                            style={styles.favoriteSlot}
                            disabled={!isOwnProfile && !favorite}
                            onPress={handlePress}
                        >
                            {favorite?.cover_url ? (
                                <Image source={{ uri: favorite.cover_url }} style={styles.favoriteCover} />
                            ) : (
                                <View style={styles.favoriteEmpty}>
                                    {isOwnProfile && (
                                        <Ionicons name="add" size={20} color={colors.textMuted} />
                                    )}
                                </View>
                            )}
                            {isOwnProfile && favorite && (
                                <Touchable
                                    style={styles.favoriteRemove}
                                    onPress={() => handleRemoveFavorite(position)}
                                    hitSlop={8}
                                >
                                    <Ionicons name="close" size={12} color={colors.textMuted} />
                                </Touchable>
                            )}
                        </Touchable>
                    );
                })}
            </View>

            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, styles.noMarginTop]}>Lists</Text>
                {isOwnProfile && (
                    <Touchable style={styles.pillLink} onPress={() => router.push("/lists/new")}>
                        <Ionicons name="add-circle-outline" size={14} color={colors.accent} />
                        <Text style={styles.actionLink}>New list</Text>
                    </Touchable>
                )}
            </View>
            {lists.length === 0 && <Text style={styles.emptyText}>No lists yet.</Text>}
            {lists.map((list) => (
                <Touchable
                    key={list.id}
                    style={styles.activityRow}
                    onPress={() => router.push(`/lists/${list.id}`)}
                >
                    <Ionicons name="list-outline" size={16} color={colors.textMuted} />
                    <View style={styles.activityRowText}>
                        <Text style={styles.activityTitle}>{list.title}</Text>
                        <Text style={styles.activityMeta}>
                            {list.item_count} {list.item_count === 1 ? "album" : "albums"}
                            {list.is_ranked ? " · Ranked" : ""}
                            {!list.is_public ? " · Private" : ""}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Touchable>
            ))}

            <Text style={styles.sectionTitle}>Recent reviews</Text>
            {reviews.length === 0 && <Text style={styles.emptyText}>No reviews yet.</Text>}
            {reviews.map((review) => (
                <Touchable key={review.id} style={styles.activityRow} onPress={() => goToEntity(review)}>
                    <View style={styles.activityRowText}>
                        <View style={styles.activityTitleRow}>
                            <Text style={styles.activityTitle}>{review.entity_name ?? "Unknown"}</Text>
                            {review.score !== null && (
                                <View style={styles.scorePill}>
                                    <Ionicons name="star" size={10} color={colors.rating} />
                                    <Text style={styles.scorePillText}>{review.score / 2}/5</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.activityBody} numberOfLines={2}>
                            {review.body}
                        </Text>
                    </View>
                </Touchable>
            ))}

            <Text style={styles.sectionTitle}>Recently logged</Text>
            {spins.length === 0 && <Text style={styles.emptyText}>Nothing logged yet.</Text>}
            {spins.map((spin) => (
                <Touchable key={spin.id} style={styles.activityRow} onPress={() => goToEntity(spin)}>
                    <Ionicons name="play-circle-outline" size={16} color={colors.textMuted} />
                    <View style={styles.activityRowText}>
                        <Text style={styles.activityTitle}>{spin.entity_name ?? "Unknown"}</Text>
                        <Text style={styles.activityMeta}>
                            {new Date(spin.listened_on).toLocaleDateString()}
                        </Text>
                    </View>
                </Touchable>
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
        padding: spacing.lg,
        gap: spacing.sm,
    },
    topBar: {
        width: "100%",
        alignItems: "flex-start",
        marginBottom: spacing.xs,
    },
    avatar: {
        width: 88,
        height: 88,
        borderRadius: radius.pill,
        marginBottom: spacing.sm,
    },
    avatarPlaceholder: {
        width: 88,
        height: 88,
        borderRadius: radius.pill,
        marginBottom: spacing.sm,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: "center",
        alignItems: "center",
    },
    avatarBadge: {
        position: "absolute",
        bottom: spacing.sm,
        right: -2,
        width: 24,
        height: 24,
        borderRadius: radius.pill,
        backgroundColor: colors.accent,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: colors.background,
    },
    avatarInitial: {
        color: colors.textMuted,
        fontSize: 32,
        fontFamily: fonts.displayBold,
    },
    displayName: {
        color: colors.text,
        fontSize: 21,
        fontFamily: fonts.displayBold,
    },
    username: {
        color: colors.textMuted,
        fontSize: 14,
    },
    bio: {
        color: colors.text,
        fontSize: 14,
        textAlign: "center",
        marginTop: spacing.xs,
    },
    statsRow: {
        flexDirection: "row",
        gap: spacing.lg,
        marginTop: spacing.sm,
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
        fontWeight: "600",
    },
    ownProfileLinks: {
        flexDirection: "row",
        gap: spacing.sm,
    },
    pillLink: {
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
    button: {
        backgroundColor: colors.accent,
        borderRadius: radius.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        marginTop: spacing.xs,
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
    formCard: {
        width: "100%",
        gap: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        padding: 10,
        backgroundColor: colors.surfaceRaised,
        color: colors.text,
    },
    textArea: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        padding: 10,
        backgroundColor: colors.surfaceRaised,
        color: colors.text,
        minHeight: 60,
        textAlignVertical: "top",
    },
    formButtons: {
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: spacing.md,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 16,
        fontFamily: fonts.displaySemiBold,
        alignSelf: "flex-start",
        marginTop: spacing.lg,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        marginTop: spacing.lg,
    },
    noMarginTop: {
        marginTop: 0,
    },
    favoritesGrid: {
        flexDirection: "row",
        gap: spacing.sm,
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
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceRaised,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: "center",
        alignItems: "center",
    },
    favoriteCover: {
        width: "100%",
        height: "100%",
        borderRadius: radius.sm,
    },
    favoriteEmpty: {
        width: "100%",
        height: "100%",
        borderRadius: radius.sm,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: "dashed",
        justifyContent: "center",
        alignItems: "center",
    },
    activityRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        width: "100%",
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        marginTop: spacing.xs,
        ...cardShadow,
        shadowOpacity: 0.12,
    },
    activityRowText: {
        flex: 1,
    },
    activityTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    scorePill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        backgroundColor: colors.ratingMuted,
        borderRadius: radius.pill,
        paddingVertical: 1,
        paddingHorizontal: 6,
    },
    scorePillText: {
        color: colors.text,
        fontSize: 11,
        fontWeight: "600",
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
