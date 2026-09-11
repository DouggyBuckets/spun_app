import { useState } from "react";
import { View, Text, TextInput, Switch, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { apiFetch, ApiError } from "../../api/client";
import { colors, spacing, radius } from "../../constants/theme";
import { Touchable } from "../../components/Touchable";
import { BackButton } from "../../components/BackButton";

export default function NewListScreen() {
    const { albumId } = useLocalSearchParams<{ albumId?: string }>();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [isRanked, setIsRanked] = useState(false);
    const [isPublic, setIsPublic] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleCreate() {
        if (!title.trim()) return;
        setError(null);
        setIsSaving(true);
        try {
            const list = await apiFetch<{ id: number }>("/lists", {
                method: "POST",
                body: JSON.stringify({
                    title,
                    description: description || undefined,
                    isRanked,
                    isPublic,
                }),
            });
            if (albumId) {
                await apiFetch(`/lists/${list.id}/items/albums/${albumId}`, { method: "POST" });
                router.back();
            } else {
                router.replace(`/lists/${list.id}`);
            }
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong");
            setIsSaving(false);
        }
    }

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <BackButton />
            </View>
            <TextInput
                style={styles.input}
                placeholder="Title"
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
                maxLength={150}
                autoFocus
            />
            <TextInput
                style={styles.textArea}
                placeholder="Description (optional)"
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={2000}
            />
            <View style={styles.switchCard}>
                <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Ranked</Text>
                    <Switch value={isRanked} onValueChange={setIsRanked} />
                </View>
                <View style={styles.switchDivider} />
                <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Public</Text>
                    <Switch value={isPublic} onValueChange={setIsPublic} />
                </View>
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
            <Touchable
                style={[styles.button, !title.trim() && styles.buttonDisabled]}
                onPress={handleCreate}
                disabled={isSaving || !title.trim()}
            >
                <Text style={styles.buttonText}>{isSaving ? "Creating..." : "Create list"}</Text>
            </Touchable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.md,
        gap: spacing.sm,
    },
    topBar: {},
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        padding: 12,
        backgroundColor: colors.surface,
        color: colors.text,
    },
    textArea: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        padding: 12,
        backgroundColor: colors.surface,
        color: colors.text,
        minHeight: 80,
        textAlignVertical: "top",
    },
    switchCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
    },
    switchRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: spacing.sm,
    },
    switchDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
    },
    switchLabel: {
        color: colors.text,
    },
    button: {
        backgroundColor: colors.accent,
        borderRadius: radius.sm,
        paddingVertical: 12,
        alignItems: "center",
        marginTop: spacing.xs,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: colors.text,
        fontWeight: "600",
    },
    error: {
        color: colors.error,
    },
});
