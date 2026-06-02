import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, Platform, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { runRetentionPolicy } from "./utils/retention";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";

function MenuHeaderButton() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => router.replace('/menu')}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.7}
      style={{
        marginRight: 6,
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(128, 128, 128, 0.15)',
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="home-outline" size={18} color={colors.textPrimary} />
    </TouchableOpacity>
  );
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function ThemedLayout() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, overflow: "hidden" }}>
      <StatusBar style={colors.statusBar} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: "bold", fontSize: 17 },
          contentStyle: { backgroundColor: colors.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="menu" options={{ headerShown: false }} />
        <Stack.Screen name="nova-conta" options={{ title: "Criar Conta" }} />
        <Stack.Screen name="cadastro" options={{ title: "Registrar Região", headerRight: () => <MenuHeaderButton /> }} />
        <Stack.Screen name="registros" options={{ title: "Monitoramento", headerRight: () => <MenuHeaderButton /> }} />
        <Stack.Screen name="alertas" options={{ title: "Alertas Climáticos", headerRight: () => <MenuHeaderButton /> }} />
      </Stack>
    </View>
  );
}

export default function Layout() {
  useEffect(() => {
    const setup = async () => {
      await runRetentionPolicy();
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "SatGuard",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#B478F0",
        });
      }
      if (Platform.OS !== "web") {
        await Notifications.requestPermissionsAsync();
      }
    };
    setup();
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedLayout />
      </AuthProvider>
    </ThemeProvider>
  );
}
