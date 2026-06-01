import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, Platform, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { runRetentionPolicy } from "./utils/retention";
import { AuthProvider } from "./context/AuthContext";

function MenuHeaderButton() {
  const router = useRouter();
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
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name="home-outline" size={18} color="#FFFFFF" />
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
    <AuthProvider>
    <View style={{ flex: 1, backgroundColor: "#07000F", overflow: "hidden" }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#120028" },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: { fontWeight: "bold", fontSize: 17 },
          contentStyle: { backgroundColor: "#07000F" },
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
    </AuthProvider>
  );
}
