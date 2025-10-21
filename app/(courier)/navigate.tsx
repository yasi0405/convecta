// app/(courier)/navigate.tsx
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
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

// ✅ Mapbox natif (interactive sur iOS en Dev Client / build)
import MapboxGL from "@rnmapbox/maps";

// Tokens
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN as string;
// Active Mapbox natif si dispo (iOS + lib liée). En Expo Go, ça sera falsy.
const HAS_MAPBOX = Platform.OS === "ios" && !!(MapboxGL as any)?.MapView;

if (HAS_MAPBOX && MAPBOX_TOKEN) {
  MapboxGL.setAccessToken(MAPBOX_TOKEN);
}

type Coords = { lat: number; lng: number };
type Step = { instruction: string; distance: number; duration: number };

export default function CourierNavigate() {
  const router = useRouter();
  const { dest, label } = useLocalSearchParams<{ dest?: string; label?: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [origin, setOrigin] = useState<Coords | null>(null);
  const [target, setTarget] = useState<Coords | null>(null);

  // ETA live
  const [etaSec, setEtaSec] = useState<number | null>(null);
  const [remainMeters, setRemainMeters] = useState<number | null>(null);
  const [nextStep, setNextStep] = useState<Step | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]); // [lng,lat]

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1) Position actuelle
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (!mounted) return;
          setOrigin({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        } else {
          setError("Permission de localisation refusée.");
        }
      } catch {
        setError("Impossible d'obtenir la position actuelle.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 2) Géocoder la destination
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
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          dest
        )}.json?limit=1&language=fr&access_token=${MAPBOX_TOKEN}`;
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
    return () => {
      mounted = false;
    };
  }, [dest]);

  // 3) Poll Directions toutes les 15s
  useEffect(() => {
    if (!MAPBOX_TOKEN || !target) return;

    const getLiveRoute = async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const o = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setOrigin(o);

        const url =
          `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
          `${o.lng},${o.lat};${target.lng},${target.lat}` +
          `?alternatives=false&geometries=geojson&overview=full&steps=true&language=fr&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url);
        const json = await res.json();

        const route = json?.routes?.[0];
        if (!route) throw new Error("Aucun itinéraire trouvé.");

        // ETA + distance restantes
        setEtaSec(Math.max(0, Math.round(route.duration as number))); // sec
        setRemainMeters(Math.max(0, Math.round(route.distance as number))); // m

        // Geometry
        const coords: [number, number][] = route.geometry?.coordinates ?? [];
        setRouteCoords(coords);

        // Prochaine manœuvre
        const firstLeg = route.legs?.[0];
        const step = firstLeg?.steps?.[0];
        setNextStep(
          step
            ? {
                instruction: step.maneuver?.instruction ?? "Continuer",
                distance: step.distance ?? 0,
                duration: step.duration ?? 0,
              }
            : null
        );
      } catch (e: any) {
        setError(e?.message ?? "Échec du calcul d'itinéraire.");
      }
    };

    getLiveRoute();
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollRef.current = setInterval(getLiveRoute, 15000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [target]);

  // 4) Static map (fallback pour Expo Go)
  const staticMapUrl = useMemo(() => {
    if (!MAPBOX_TOKEN) return null;
    const fallback = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/4.3517,50.8503,12,0/800x600?access_token=${MAPBOX_TOKEN}`;
    const mkA = origin ? `pin-l-a+000000(${origin.lng},${origin.lat})` : null;
    const mkB = target ? `pin-l-b+ff0000(${target.lng},${target.lat})` : null;
    const sampled = downsample(routeCoords, 80);
    const path =
      sampled.length >= 2
        ? `path-5+1e88e5-0.8(${sampled.map(([lng, lat]) => `${lng},${lat}`).join(";")})`
        : null;

    if (origin && target) {
      const overlays = [mkA, mkB, path].filter(Boolean).join(",");
      return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays}/auto/800x600?attribution=false&logo=false&access_token=${MAPBOX_TOKEN}&ts=${Date.now()}`;
    }
    if (target && !origin) {
      const overlays = [mkB, path].filter(Boolean).join(",");
      return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays}/${target.lng},${target.lat},14,0/800x600?attribution=false&logo=false&access_token=${MAPBOX_TOKEN}&ts=${Date.now()}`;
    }
    return fallback;
  }, [origin, target, routeCoords]);

  const openExternalNavigation = async () => {
    const q = dest ? encodeURIComponent(dest) : "";
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${q}`
        : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    const can = await Linking.canOpenURL(url);
    await Linking.openURL(can ? url : `https://www.google.com/maps/dir/?api=1&destination=${q}`);
  };

  const etaText = etaSec != null ? formatETA(etaSec) : "—";
  const distText = remainMeters != null ? formatKm(remainMeters) : "—";

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

      {/* Infos ETA */}
      <View style={styles.infoBar}>
        <Text style={styles.infoText}>⏱️ {etaText}</Text>
        <Text style={styles.dot}>•</Text>
        <Text style={styles.infoText}>📍 {distText} restantes</Text>
      </View>

      {/* 🗺️ Carte : MapboxGL interactif (iOS build/Dev Client) OU image statique (Expo Go) */}
      <View style={styles.mapWrap}>
        {loading || !target ? (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.centerText}>Initialisation…</Text>
          </View>
        ) : HAS_MAPBOX && origin ? (
          <MapboxGL.MapView
            style={StyleSheet.absoluteFillObject}
            styleURL={MapboxGL.StyleURL.Street}
            logoEnabled={false}
            attributionEnabled={false}
            compassEnabled
          >
            <MapboxGL.Camera
              centerCoordinate={[origin.lng, origin.lat]}
              zoomLevel={13}
              animationMode="flyTo"
              animationDuration={800}
            />
            {/* Position live */}
            <MapboxGL.UserLocation visible requestsAlwaysUse={false} />
            {/* Départ / Arrivée */}
            <MapboxGL.PointAnnotation id="start" coordinate={[origin.lng, origin.lat]}>
              <View style={styles.pinBlack} />
            </MapboxGL.PointAnnotation>

            <MapboxGL.PointAnnotation id="end" coordinate={[target.lng, target.lat]}>
              <View style={styles.pinRed} />
            </MapboxGL.PointAnnotation>
            {/* Tracé du trajet */}
            {routeCoords.length > 1 && (
              <MapboxGL.ShapeSource
                id="route"
                shape={{
                  type: "Feature",
                  geometry: { type: "LineString", coordinates: routeCoords },
                  properties: {},
                }}
              >
                <MapboxGL.LineLayer
                  id="route-line"
                  style={{ lineWidth: 5, lineCap: "round", lineJoin: "round", lineColor: "#1e88e5" }}
                />
              </MapboxGL.ShapeSource>
            )}
          </MapboxGL.MapView>
        ) : (
          // Fallback image (Expo Go / pas d'origine encore)
          staticMapUrl && (
            <Image
              source={{ uri: staticMapUrl }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
              accessible
              accessibilityLabel="Carte avec itinéraire"
            />
          )
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {error ? (
          <Text style={[styles.destText, { color: "#ff6b6b" }]} numberOfLines={2}>
            {error}
          </Text>
        ) : (
          <>
            <Text style={styles.destText} numberOfLines={2}>
              {dest || "Destination inconnue"}
            </Text>
            {nextStep && (
              <Text style={[styles.destText, { opacity: 0.9 }]} numberOfLines={2}>
                ◾ Prochaine manœuvre : {nextStep.instruction} ({formatKm(nextStep.distance)} · {formatETA(nextStep.duration)})
              </Text>
            )}
          </>
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

/** Downsample une liste de coords [lng,lat] pour l'overlay Static. */
function downsample(coords: [number, number][], maxPts: number): [number, number][] {
  if (!coords || coords.length <= maxPts) return coords ?? [];
  const step = Math.max(1, Math.floor(coords.length / maxPts));
  const out: [number, number][] = [];
  for (let i = 0; i < coords.length; i += step) out.push(coords[i]);
  const last = coords[coords.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

function formatETA(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h} h ${rm} min`;
}

function formatKm(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km.toFixed(km >= 10 ? 0 : 1)} km`;
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

  infoBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#0f172a",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#222",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: { color: "#fff", fontWeight: "600" },
  dot: { color: "#6b7280" },

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
  destText: { color: "#fff", opacity: 0.95 },
  navBtn: {
    backgroundColor: "#1e88e5",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
  },
  navBtnText: { color: "#fff", fontWeight: "700" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerText: { color: "#fff", marginTop: 8 },
  pinBlack: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#000",
    borderWidth: 2,
    borderColor: "#fff",
  },
  pinRed: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#e53935",
    borderWidth: 2,
    borderColor: "#fff",
  },
});