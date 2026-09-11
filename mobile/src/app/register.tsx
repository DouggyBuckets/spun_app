import { useState } from "react";
import { View, TextInput, Text, StyleSheet } from "react-native";
import { Redirect, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { colors, spacing, radius, fonts } from "../constants/theme";
import { Touchable } from "../components/Touchable";

export default function RegisterScreen() {
    const { register, user } = useAuth();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (user) {
        return <Redirect href="/" />;
    }

    async function handleSubmit() {
        setError(null);
        setIsSubmitting(true);
        try {
            await register(username, email, password);
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
            } else {
                setError("An unexpected error occurred");
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <View style={styles.container}>
            <Text style={styles.brand}>Spun</Text>
            <Text style={styles.tagline}>Create an account to get started.</Text>

            <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={18} color={colors.textMuted} />
                <TextInput
                    style={styles.input}
                    placeholder="Username"
                    placeholderTextColor={colors.textMuted}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                />
            </View>
            <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />
            </View>
            <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
            <Touchable style={styles.button} onPress={handleSubmit} disabled={isSubmitting}>
                <Text style={styles.buttonText}>
                    {isSubmitting ? "Creating account..." : "Sign Up"}
                </Text>
            </Touchable>
            <Link href="/login">
                <Text style={styles.link}>Already have an account? Log in</Text>
            </Link>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        padding: spacing.lg,
        gap: spacing.sm,
        backgroundColor: colors.background,
    },
    brand: {
        color: colors.text,
        fontSize: 34,
        fontFamily: fonts.displayBold,
        textAlign: "center",
        marginBottom: 2,
    },
    tagline: {
        color: colors.textMuted,
        textAlign: "center",
        marginBottom: spacing.lg,
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
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        color: colors.text,
    },
    button: {
        backgroundColor: colors.accent,
        borderRadius: radius.md,
        padding: 14,
        alignItems: "center",
        marginTop: spacing.xs,
    },
    buttonText: {
        color: colors.text,
        fontWeight: "600",
    },
    error: {
        color: colors.error,
    },
    link: {
        color: colors.accent,
        textAlign: "center",
        marginTop: spacing.sm,
    },
});
