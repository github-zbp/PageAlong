import type { PropsWithChildren } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/providers/ThemeProvider";

type Props = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
}>;

export function BottomSheet({ visible, onClose, children }: Props) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityLabel="关闭"
          accessibilityRole="button"
          onPress={onClose}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)" }}
        />
        <View
          style={{
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            backgroundColor: tokens.surface,
            paddingBottom: Math.max(insets.bottom, 20),
            paddingHorizontal: 16,
            paddingTop: 10
          }}
        >
          <View
            style={{
              alignSelf: "center",
              backgroundColor: tokens.border,
              borderRadius: 2,
              height: 4,
              marginBottom: 12,
              width: 36
            }}
          />
          {children}
        </View>
      </View>
    </Modal>
  );
}
