import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";
import { View, Animated, StyleSheet, Dimensions, Easing, TouchableOpacity, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TText } from "./TText";
import { paybidColors } from "../paybidTheme";
import { spacing, radii } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ToastType = "success" | "error" | "warning" | "info";

type Toast = {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
};

type ToastOptions = {
  title: string;
  message?: string;
  duration?: number;
};

type ToastContextValue = {
  success: (opts: ToastOptions) => void;
  error: (opts: ToastOptions) => void;
  warning: (opts: ToastOptions) => void;
  info: (opts: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TYPE_CONFIG: Record<ToastType, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}> = {
  success: { icon: "checkmark-circle", color: "#10B981", bg: "#E6F8F0" },
  error: { icon: "close-circle", color: "#EF4444", bg: "#FEE2E2" },
  warning: { icon: "alert-circle", color: "#F59E0B", bg: "#FEF3C7" },
  info: { icon: "information-circle", color: "#3B82F6", bg: "#DBEAFE" },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const cfg = TYPE_CONFIG[toast.type];
  const { width: screenWidth } = useWindowDimensions();
  const isSmallScreen = screenWidth < 360;
  const slideAnim = useRef(new Animated.Value(-Dimensions.get("window").height * 0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  // Responsive sizing
  const maxToastWidth = Math.min(screenWidth - 2 * spacing.lg, 440);
  const iconSize = isSmallScreen ? 18 : 22;
  const iconWrapSize = isSmallScreen ? 34 : 40;
  const horizontalPadding = isSmallScreen ? 10 : 12;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 250,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss(toast.id));
    }, toast.duration || 3500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
          marginTop: insets.top + 8,
        },
      ]}
    >
      <View style={[styles.toast, {
        borderLeftColor: cfg.color,
        maxWidth: maxToastWidth,
        alignSelf: "center",
        paddingHorizontal: horizontalPadding,
      }]}>
        <View style={[styles.iconWrap, { backgroundColor: cfg.bg, width: iconWrapSize, height: iconWrapSize, borderRadius: iconWrapSize / 2 }]}>
          <Ionicons name={cfg.icon} size={iconSize} color={cfg.color} />
        </View>
        <View style={styles.content}>
          <TText variant="caption" weight="extraBold" color={paybidColors.neutrals.textPrimary} numberOfLines={1}>
            {toast.title}
          </TText>
          {toast.message ? (
            <TText variant="label" color={paybidColors.neutrals.textSecondary} numberOfLines={3} style={{ marginTop: 2 }}>
              {toast.message}
            </TText>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => onDismiss(toast.id)}
          style={styles.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={isSmallScreen ? 14 : 16} color={paybidColors.neutrals.textTertiary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((type: ToastType, opts: ToastOptions) => {
    const id = ++idCounter.current;
    setToasts((prev) => [...prev.slice(-2), { id, type, ...opts }]);
  }, []);

  const value: ToastContextValue = {
    success: (opts) => show("success", opts),
    error: (opts) => show("error", opts),
    warning: (opts) => show("warning", opts),
    info: (opts) => show("info", opts),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View style={styles.overlay} pointerEvents="box-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    console.warn("[Toast] useToast used outside ToastProvider — falling back to no-op");
    return {
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    };
  }
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  container: {
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: radii.lg,
    borderLeftWidth: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 8,
  },
});
