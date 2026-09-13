import { useState } from "react";
import { View, Text, TextInput, Modal, StyleSheet } from "react-native";
import { Touchable } from "./Touchable";
import { apiFetch, ApiError } from "../api/client";
import { colors, spacing, radius, fonts } from "../constants/theme";

type ReportTarget =
    | { targetType: "user"; username: string }
    | { targetType: "review"; reviewId: number };

interface ReportModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    target: ReportTarget;
}

export function ReportModal({ visible, onClose, title, target }: ReportModalProps) {
    const [reason, setReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    function handleClose() {
        onClose();
        setReason("");
        setError(null);
        setSent(false);
    }

    async function handleSubmit() {
        setError(null);
        setIsSubmitting(true);
        try {
            await apiFetch("/reports", {
                method: "POST",
                body: JSON.stringify({ ...target, reason: reason.trim() }),
            });
            setSent(true);
            setTimeout(handleClose, 1000);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <Touchable style={styles.backdrop} onPress={handleClose} />
            <View style={styles.center} pointerEvents="box-none">
                <View style={styles.card}>
                    <Text style={styles.title}>{title}</Text>
                    {sent ? (
                        <Text style={styles.confirmText}>Report submitted. Thank you.</Text>
                    ) : (
                        <>
                            <TextInput
                                style={styles.textArea}
                                placeholder="What's going on?"
                                placeholderTextColor={colors.textMuted}
                                value={reason}
                                onChangeText={setReason}
                                multiline
                                maxLength={500}
                            />
                            {error && <Text style={styles.error}>{error}</Text>}
                            <View style={styles.formButtons}>
                                <Touchable onPress={handleClose}>
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </Touchable>
                                <Touchable
                                    style={styles.submitButton}
                                    onPress={handleSubmit}
                                    disabled={isSubmitting || !reason.trim()}
                                >
                                    <Text style={styles.submitButtonText}>
                                        {isSubmitting ? "Submitting..." : "Submit"}
                                    </Text>
                                </Touchable>
                            </View>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "#00000099",
    },
    center: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "center",
    },
    card: {
        width: "85%",
        backgroundColor: colors.surfaceRaised,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.sm,
    },
    title: {
        color: colors.text,
        fontSize: 16,
        fontFamily: fonts.displaySemiBold,
        marginBottom: spacing.xs,
    },
    textArea: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.sm,
        padding: 10,
        backgroundColor: colors.surface,
        color: colors.text,
        minHeight: 70,
        textAlignVertical: "top",
    },
    formButtons: {
        flexDirection: "row",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: spacing.md,
    },
    cancelText: {
        color: colors.accent,
        fontWeight: "600",
    },
    submitButton: {
        backgroundColor: colors.accent,
        borderRadius: radius.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
    },
    submitButtonText: {
        color: colors.text,
        fontWeight: "600",
    },
    confirmText: {
        color: colors.text,
    },
    error: {
        color: colors.error,
    },
});
