import { Tabs } from "expo-router";
import React from "react";

export default function ReceiverLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" }, // pas de tabs visibles
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home" }}
      />
      <Tabs.Screen
        name="summary"
        options={{ href: null, headerShown: true, title: "Résumé du colis" }}
      />
    </Tabs>
  );
}