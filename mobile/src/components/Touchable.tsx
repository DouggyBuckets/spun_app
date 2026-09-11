import { Pressable, PressableProps, PressableStateCallbackType, StyleProp, ViewStyle } from "react-native";

interface TouchableProps extends Omit<PressableProps, "style"> {
    style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
}

// A drop-in replacement for Pressable that dims on press — RN's Pressable gives
// no visual feedback by default, which was flagged as making the app feel unresponsive.
export function Touchable({ style, disabled, ...props }: TouchableProps) {
    return (
        <Pressable
            disabled={disabled}
            style={(state) => [
                typeof style === "function" ? style(state) : style,
                state.pressed && !disabled ? { opacity: 0.6 } : null,
            ]}
            {...props}
        />
    );
}
