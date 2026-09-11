import { StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../constants/theme";
import { Touchable } from "./Touchable";

// A consistent back affordance for every drill-in screen, now that the
// native Stack header (which showed raw route names like "[id]") is hidden.
export function BackButton() {
    return (
        <Touchable style={styles.button} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Touchable>
    );
}

const styles = StyleSheet.create({
    button: {
        width: 36,
        height: 36,
        borderRadius: radius.pill,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: "center",
        alignItems: "center",
    },
});
