import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import TabBarBackground from "@/components/ui/TabBarBackground";
import Colors from "@/constants/Colors";

export default function TabLayout() {
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
      {/* 🏠 Page principale : liste des colis à accepter */}
      <Tabs.Screen
        name="home"
        options={{
          title: "Colis",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="shippingbox.fill" color={color} />
          ),
        }}
      />

      {/* 🧭 Navigation active (livraison en cours) */}
      <Tabs.Screen
        name="navigate"
        options={{
          title: "Navigation",
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