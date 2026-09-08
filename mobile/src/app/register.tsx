import { useState } from "react";
import { View, TextInput, Pressable, Text, StyleSheet } from "react-native";
import { Redirect, Link } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { colors } from "../constants/theme";

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
            <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
            />
            <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
            />
            <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable style={styles.button} onPress={handleSubmit} disabled={isSubmitting}>
                <Text style={styles.buttonText}>{isSubmitting ? "Creating account..." : "Sign Up"}</Text>
            </Pressable>
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
        padding: 24,
        gap: 12,
        backgroundColor: colors.background,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 12,
        backgroundColor: colors.surface,
        color: colors.text,
    },
    button: {
        backgroundColor: colors.accent,
        borderRadius: 8,
        padding: 14,
        alignItems: "center",
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
        marginTop: 8,
    },
});
