import { Stack } from "expo-router";
import {
    useFonts,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { View, Text, StyleSheet, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../constants/theme";

// The UI was designed at phone width only. On web, constrain content to a
// centered column instead of letting it stretch edge-to-edge on a desktop
// browser window.
const webContentStyle =
    Platform.OS === "web"
        ? { maxWidth: 600, width: "100%" as const, marginHorizontal: "auto" as const }
        : null;

function RootLayoutContent() {
    const { isLoading } = useAuth();
    const [fontsLoaded] = useFonts({
        SpaceGrotesk_600SemiBold,
        SpaceGrotesk_700Bold,
    });

    if (isLoading || !fontsLoaded) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading...</Text>
            </View>
        );
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: [{ backgroundColor: colors.background }, webContentStyle],
            }}
        />
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
    },
    loadingText: {
        color: colors.text,
    },
});

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <RootLayoutContent />
            </AuthProvider>
        </SafeAreaProvider>
    );
}
