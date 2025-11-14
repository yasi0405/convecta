import { Tabs } from "expo-router";
import React from "react";
import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/ui/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import TabBarBackground from "@/components/ui/TabBarBackground";
import Colors from "@/theme/Colors";

export default function TabLayout() {
  const { bottom } = useSafeAreaInsets();
  const tabBarMetrics = useMemo(() => {
    const safeBottom = Math.max(bottom, 10);
    const baseHeight = 62;
    return {
      paddingBottom: safeBottom,
      height: baseHeight + safeBottom,
    };
  }, [bottom]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarActiveTintColor: Colors.background,
        tabBarInactiveTintColor: "rgba(255,255,255,0.6)",
        tabBarStyle: {
          backgroundColor: Colors.accent,
          borderTopWidth: 0,
          elevation: 0,
          position: "absolute",
          paddingBottom: tabBarMetrics.paddingBottom,
          height: tabBarMetrics.height,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          marginBottom: 2,
        },
      }}
    >
      {/* 🧭 Navigation active (livraison en cours) */}
      <Tabs.Screen
        name="navigate"
        options={{
          title: "Navigation",
          tabBarStyle: { display: "none" },
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="location.fill" color={color} />
          ),
        }}
      />

      {/* ⏳ Missions en attente */}
      <Tabs.Screen
        name="pending"
        options={{
          title: "En attente",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="clock.fill" color={color} />
          ),
        }}
      />

      {/* 👤 Profil ou paramètres du livreur */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="person.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
