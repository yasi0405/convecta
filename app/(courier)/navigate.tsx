// app/(courier)/navigate.tsx
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Linking,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN as string;

type Coords = { lat: number; lng: number };

export default function CourierNavigate() {
  const router = useRouter();
  const { dest, label } = useLocalSearchParams<{ dest?: string; label?: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [origin, setOrigin] = useState<Coords | null>(null);
  const [target, setTarget] = useState<Coords | null>(null);

  // 1) Récupérer la position actuelle (facultatif pour l'image, utile pour navigation externe)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({});
          if (!mounted) return;
          setOrigin({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      } catch {
        // ignore, on utilisera Bruxelles par défaut
      }
    })();
    return () => { mounted = false; };
  }, []);

  // 2) Géocoder l'adresse destination avec Mapbox Geocoding
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!dest) {
        setError("Adresse de destination manquante.");
        setLoading(false);
        return;
      }
      if (!MAPBOX_TOKEN) {
        setError("Clé Mapbox absente (EXPO_PUBLIC_MAPBOX_TOKEN).");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          dest
        )}.json?limit=1&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url);
        const json = await res.json();
        const feat = json?.features?.[0];
        if (!feat) throw new Error("Adresse introuvable.");
        const [lng, lat] = feat.center;
        if (!mounted) return;
        setTarget({ lat, lng });
      } catch (e: any) {
        setError(e?.message ?? "Échec du géocodage.");
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [dest]);

  // 3) Construire l'URL de la carte statique (markers + auto fit si 2 points)
  const staticMapUrl = useMemo(() => {
    if (!MAPBOX_TOKEN) return null;

    // Default: Bruxelles
    const fallback = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/4.3517,50.8503,12,0/800x600?access_token=${MAPBOX_TOKEN}`;

    // Si on a la destination uniquement
    if (target && !origin) {
      const markerDest = `pin-l-b+ff0000(${target.lng},${target.lat})`;
      return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${markerDest}/${target.lng},${target.lat},14,0/800x600?access_token=${MAPBOX_TOKEN}`;
    }

    // Si on a origine + destination → on laisse Mapbox cadrer automatiquement
    if (origin && target) {
      const markerA = `pin-l-a+000000(${origin.lng},${origin.lat})`;   // noir
      const markerB = `pin-l-b+ff0000(${target.lng},${target.lat})`;   // rouge
      // "auto" = cadrage automatique sur les overlays
      return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${markerA},${markerB}/auto/800x600?access_token=${MAPBOX_TOKEN}`;
    }

    // Sinon fallback
    return fallback;
  }, [origin, target]);

  const openExternalNavigation = async () => {
    const q = dest ? encodeURIComponent(dest) : "";
    // On tente d'abord Apple/Google Maps en fonction de la plateforme
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${q}`
        : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    const can = await Linking.canOpenURL(url);
    if (can) {
      await Linking.openURL(url);
    } else {
      // Fallback très générique
      await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#111" }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {label || "Navigation"}
        </Text>
      </View>

      {/* Carte */}
      <View style={styles.mapWrap}>
        {(!staticMapUrl || loading) && (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.centerText}>Préparation de la carte…</Text>
          </View>
        )}
        {!!staticMapUrl && !loading && (
          <Image
            source={{ uri: staticMapUrl }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            accessible
            accessibilityLabel="Carte statique"
          />
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {error ? (
          <Text style={[styles.destText, { color: "#ff6b6b" }]} numberOfLines={2}>
            {error}
          </Text>
        ) : (
          <Text style={styles.destText} numberOfLines={2}>
            {dest || "Destination inconnue"}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.navBtn, !dest && { opacity: 0.6 }]}
          onPress={openExternalNavigation}
          disabled={!dest}
        >
          <Text style={styles.navBtnText}>Démarrer la navigation</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#111",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#222",
  },
  headerBtnText: { color: "#fff" },
  headerTitle: { color: "#fff", fontWeight: "700", fontSize: 16, flex: 1 },

  mapWrap: {
    flex: 1,
    backgroundColor: "#000",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#222",
  },

  footer: {
    padding: 12,
    backgroundColor: "#111",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#222",
    gap: 8,
  },
  destText: { color: "#fff", opacity: 0.9 },
  navBtn: {
    backgroundColor: "#1e88e5",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  navBtnText: { color: "#fff", fontWeight: "700" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerText: { color: "#fff", marginTop: 8 },
});