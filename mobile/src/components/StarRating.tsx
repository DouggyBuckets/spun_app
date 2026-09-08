import { View, Pressable, Text, StyleSheet } from "react-native";
import { colors } from "../constants/theme";

interface StarRatingProps {
    score: number | null; // 1-10 (half-star units), or null if unrated
    onRate: (score: number) => void;
}

export function StarRating({ score, onRate }: StarRatingProps) {
    const filledStars = score ? Math.round(score / 2) : 0;

    return (
        <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => onRate(star * 2)}>
                    <Text style={[styles.star, star <= filledStars && styles.starFilled]}>★</Text>
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        gap: 4,
    },
    star: {
        fontSize: 32,
        color: colors.border,
    },
    starFilled: {
        color: colors.accent,
    },
});
