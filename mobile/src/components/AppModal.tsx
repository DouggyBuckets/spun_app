import { Modal, Platform, View, type ModalProps } from "react-native";

// React Native's Modal doesn't establish a real fixed full-screen overlay on
// react-native-web — it renders in the normal component tree, so a "fixed"
// position inside it still measures against whatever ancestor box reactively
// ends up as its containing block instead of the true viewport. The reliable
// fix on web is a real DOM portal straight to document.body, same as React's
// own Portal API exists for. Native platforms are untouched — this is a
// transparent passthrough to the real Modal there.
export function AppModal({ visible, onRequestClose, children, ...rest }: ModalProps) {
    if (Platform.OS === "web") {
        if (!visible) return null;
        const { createPortal } = require("react-dom");
        return createPortal(
            <View
                style={{
                    position: "fixed" as "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 1000,
                }}
            >
                {children}
            </View>,
            document.body
        );
    }

    return (
        <Modal visible={visible} onRequestClose={onRequestClose} {...rest}>
            {children}
        </Modal>
    );
}
