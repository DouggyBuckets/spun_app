import { useState } from "react";
import { View, Text, TextInput, Switch, Pressable, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { apiFetch, ApiError } from "../../api/client";
import { colors } from "../../constants/theme";

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
            <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Ranked</Text>
                <Switch value={isRanked} onValueChange={setIsRanked} />
            </View>
            <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Public</Text>
                <Switch value={isPublic} onValueChange={setIsPublic} />
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable
                style={[styles.button, !title.trim() && styles.buttonDisabled]}
                onPress={handleCreate}
                disabled={isSaving || !title.trim()}
            >
                <Text style={styles.buttonText}>{isSaving ? "Creating..." : "Create list"}</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        padding: 16,
        gap: 12,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 12,
        backgroundColor: colors.surface,
        color: colors.text,
    },
    textArea: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 12,
        backgroundColor: colors.surface,
        color: colors.text,
        minHeight: 80,
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
    button: {
        backgroundColor: colors.accent,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: "center",
        marginTop: 8,
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
