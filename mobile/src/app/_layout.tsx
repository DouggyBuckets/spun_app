import { Stack } from "expo-router";
import {
    useFonts,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../constants/theme";

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
                contentStyle: { backgroundColor: colors.background },
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
        <AuthProvider>
            <RootLayoutContent />
        </AuthProvider>
    );
}
