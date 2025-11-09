import { useProfileGate } from "@/features/user/useProfileGate";
import { ensureAmplifyConfigured } from "@/lib/amplify";
import Colors from "@/theme/Colors";
import { Asset } from "expo-asset";
import * as Location from "expo-location";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SvgUri } from "react-native-svg";

ensureAmplifyConfigured();

export default function Dashboard() {
  const router = useRouter();
  const gate = useProfileGate();
  const canProceed = gate === "ok";

  // --- UI principale ---
  const [center, setCenter] = useState<[number, number]>([4.3517, 50.8503]); // [lng, lat] Bruxelles par défaut
  const [zoom, setZoom] = useState(12);
  const [mode, setMode] = useState<"courier" | "receiver">("receiver");

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return; // garde le fallback Bruxelles
        const pos = await Location.getCurrentPositionAsync({});
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;
        if (isMounted && Number.isFinite(lng) && Number.isFinite(lat)) {
          setCenter([lng, lat]);
          setZoom(12);
        }
      } catch (e) {
        // ignore: fallback Bruxelles
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Redirection onboarding forcée tant que le user n'est pas complet
  useEffect(() => {
    if (gate === "needsOnboarding") {
      router.replace("/home/onboarding" as Href);
    }
  }, [gate]);

  if (gate === "loading") return null; 

  const logoUri = Asset.fromModule(require("../assets/images/logo.svg")).uri;

  return (
    <View style={styles.container}>
      <SvgUri uri={logoUri} width={200} height={200} style={styles.logo} />
      <View style={styles.mapContainer}>
        <Image
          source={{
            uri: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${center[0]},${center[1]},${zoom},0/800x600?access_token=${process.env.EXPO_PUBLIC_MAPBOX_TOKEN}`,
          }}
          accessible
          accessibilityLabel="Carte de la ville"
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
        <View style={styles.modeCard}>
          <View style={styles.switchRow}>
            <Text style={[styles.modeText, styles.switchItem]}>Récepteur</Text>
            <Switch
              style={styles.switchItem}
              value={mode === "courier"}
              onValueChange={(val) => setMode(val ? "courier" : "receiver")}
            />
            <Text style={[styles.modeText, styles.switchItem]}>Livreur</Text>
          </View>
          <TouchableOpacity
            style={[styles.confirmButton, !canProceed ? { opacity: 0.5 } : null]}
            disabled={!canProceed}
            onPress={() =>
              router.replace((mode === "courier" ? "/(courier)/navigate" : "/(receiver)/home") as Href)
            }
            accessibilityLabel={canProceed ? "Continuer" : "Profil incomplet, ouvrir l'onboarding"}
          >
            <Text style={styles.confirmButtonText}>{canProceed ? "Confirmer" : "Complète ton profil"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 20,
  },
  logo: {
    height: 40,
    alignSelf: "center",
  },
  mapContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeCard: {
    position: "absolute",
    top: "50%",
    alignSelf: "center",
    transform: [{ translateY: -50 }],
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    zIndex: 10,
  },
  modeText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButton: {
    marginTop: 10,
    backgroundColor: Colors.accent,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "center",
  },
  confirmButtonText: {
    color: Colors.background,
    fontWeight: "bold",
    fontSize: 14,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  switchItem: {
    marginHorizontal: 6,
  },
});
