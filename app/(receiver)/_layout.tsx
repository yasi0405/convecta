import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import TabBarBackground from "@/components/ui/TabBarBackground";
import Colors from "@/constants/Colors";

export default function ReceiverLayout() {
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
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          marginBottom: 2,
        },
      }}
    >
      {/* 🏠 Accueil - Création de colis */}
      <Tabs.Screen
        name="home/index"
        options={{
          title: "Nouveau colis",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="plus.circle.fill" color={color} />
          ),
        }}
      />

      {/* 📥 Colis à recevoir (liste de réception) */}
      <Tabs.Screen
        name="incoming"
        options={{
          title: "À recevoir",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="tray.and.arrow.down.fill" color={color} />
          ),
        }}
      />

      {/* ⏳ Colis en attente d’envoi */}
      <Tabs.Screen
        name="pending"
        options={{
          title: "Mes colis",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="cube.box.fill" color={color} />
          ),
        }}
      />

      {/* 🫥 Masquer la page Résumé de la TabBar */}
      <Tabs.Screen
        name="home/summary"
        options={{ href: null }}
      />
    </Tabs>
  );
}