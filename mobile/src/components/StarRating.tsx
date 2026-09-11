import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import { Touchable } from "./Touchable";

const STAR_SIZE = 32;

interface StarRatingProps {
    score: number | null; // 1-10 (half-star units), or null if unrated
    onRate: (score: number) => void;
}

export function StarRating({ score, onRate }: StarRatingProps) {
    return (
        <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((position) => {
                const fullValue = position * 2;
                const halfValue = fullValue - 1;

                const iconName =
                    !score || score < halfValue
                        ? "star-outline"
                        : score < fullValue
                          ? "star-half"
                          : "star";

                return (
                    <View key={position} style={styles.starWrapper}>
                        <Ionicons
                            name={iconName}
                            size={STAR_SIZE}
                            color={iconName === "star-outline" ? colors.border : colors.rating}
                        />
                        <View style={styles.hitZones}>
                            <Touchable style={styles.halfHit} onPress={() => onRate(halfValue)} />
                            <Touchable style={styles.halfHit} onPress={() => onRate(fullValue)} />
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        gap: 4,
    },
    starWrapper: {
        width: STAR_SIZE,
        height: STAR_SIZE,
    },
    hitZones: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: "row",
    },
    halfHit: {
        flex: 1,
    },
});
