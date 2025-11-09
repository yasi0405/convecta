// app/(courier)/navigate.tsx
import Colors from "@/theme/Colors";
import { useAddressAutocomplete } from "@/features/receiver/home/hooks/useAddressAutocomplete";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import MapboxGL from "@rnmapbox/maps";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN as string;
const HAS_MAPBOX = Platform.OS === "ios" && !!(MapboxGL as any)?.MapView && !!MAPBOX_TOKEN;
if (HAS_MAPBOX && MAPBOX_TOKEN) {
  MapboxGL.setAccessToken(MAPBOX_TOKEN);
}

const DESTINATIONS: Destination[] = [
  { id: "brussels", label: "Bruxelles", missions: "15 missions disponibles", query: "Bruxelles, Belgique" },
  { id: "lille", label: "Lille", missions: "8 missions disponibles", query: "Lille, France" },
  { id: "charleroi", label: "Charleroi", missions: "3 livraisons express", query: "Charleroi, Belgique" },
] as const;

const OFFER_PRESETS = [
  {
    id: "eco",
    title: "Eco Connect",
    hourly: "18 €/h",
    duration: "2h05",
    distance: "38 km",
    bonus: "+ 8,40 €",
    description: "Itinéraire fluide, minimum d'arrêt, idéal pour limiter l'empreinte carbone.",
  },
  {
    id: "balanced",
    title: "Proposition Convecta",
    hourly: "21 €/h",
    duration: "2h30",
    distance: "42 km",
    bonus: "+ 12,10 €",
    description: "Compromis optimal : meilleure rémunération et charge utile garantie.",
  },
  {
    id: "max",
    title: "Max Boost",
    hourly: "24 €/h",
    duration: "3h10",
    distance: "56 km",
    bonus: "+ 18,90 €",
    description: "Trajet plus long mais optimisé pour rattacher un maximum de cargaisons.",
  },
] as const;

const STOP_REASONS = [
  "Problème véhicule",
  "Accident / sécurité",
  "Client injoignable",
  "Météo",
  "Autre",
] as const;

type Stage = "dest" | "offer" | "live";
type Destination = {
  id: string;
  label: string;
  missions: string;
  query: string;
};
type Offer = typeof OFFER_PRESETS[number];
type Coords = { lat: number; lng: number };

type Step = { instruction: string; distance: number; duration: number };

export default function CourierNavigate() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("dest");
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [destLabel, setDestLabel] = useState<string | null>(null);
  const [destAddress, setDestAddress] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { suggestions, setSuggestions } = useAddressAutocomplete(searchQuery);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState<Coords | null>(null);
  const [target, setTarget] = useState<Coords | null>(null);
  const [etaSec, setEtaSec] = useState<number | null>(null);
  const [remainMeters, setRemainMeters] = useState<number | null>(null);
  const [nextStep, setNextStep] = useState<Step | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanVisible, setScanVisible] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [scannedOnce, setScannedOnce] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"ongoing" | "completed">("ongoing");
  const [pauseActive, setPauseActive] = useState(false);
  const [pauseRemaining, setPauseRemaining] = useState<number | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [stopPickerOpen, setStopPickerOpen] = useState(false);
  const [stopReason, setStopReason] = useState<string | null>(null);

  const resetLiveData = () => {
    setOrigin(null);
    setTarget(null);
    setEtaSec(null);
    setRemainMeters(null);
    setNextStep(null);
    setRouteCoords([]);
    setError(null);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const goBackToDest = () => {
    resetLiveData();
    setStage("dest");
    setSelectedOffer(null);
    setDestLabel(null);
    setDestAddress(null);
  };

  const handleAcceptOffer = () => {
    if (!selectedDestination || !selectedOffer) return;
    setDestAddress(selectedDestination.query);
    setDestLabel(selectedDestination.label);
    setStage("live");
  };

  // 1. Locate courier whenever stage=live
  useEffect(() => {
    if (stage !== "live") return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("Permission de localisation refusée.");
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!mounted) return;
        setOrigin({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        setError("Impossible d'obtenir la position actuelle.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [stage]);

  // 2. Geocode destination
  useEffect(() => {
    if (stage !== "live" || !destAddress) return;
    let mounted = true;
    (async () => {
      if (!MAPBOX_TOKEN) {
        setError("Clé Mapbox absente (EXPO_PUBLIC_MAPBOX_TOKEN).");
        return;
      }
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          destAddress
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
      }
    })();
    return () => {
      mounted = false;
    };
  }, [stage, destAddress]);

  // 3. Directions polling
  useEffect(() => {
    if (stage !== "live" || !MAPBOX_TOKEN || !target) return;
    let cancelled = false;

    const fetchRoute = async () => {
      try {
        let current: Coords | null = null;
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          current = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        } catch {
          const last = await Location.getLastKnownPositionAsync();
          if (last) current = { lat: last.coords.latitude, lng: last.coords.longitude };
        }
        if (!current && origin) current = origin;
        if (!current) return;
        if (cancelled) return;
        setOrigin(current);

        const url =
          `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
          `${current.lng},${current.lat};${target.lng},${target.lat}` +
          `?alternatives=false&geometries=geojson&overview=full&steps=true&language=fr&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url);
        const json = await res.json();
        const route = json?.routes?.[0];
        if (!route) throw new Error("Aucun itinéraire trouvé.");
        if (cancelled) return;

        setEtaSec(Math.max(0, Math.round(route.duration)));
        setRemainMeters(Math.max(0, Math.round(route.distance)));
        const coords: [number, number][] = route.geometry?.coordinates ?? [];
        setRouteCoords(coords);
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
      } catch (e) {
        console.log("fetchRoute error:", e);
      }
    };

    fetchRoute();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchRoute, 15000);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [stage, target]);

  const staticMapUrl = useMemo(() => {
    if (!MAPBOX_TOKEN) return null;
    const fallback = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/4.3517,50.8503,12,0/800x600?access_token=${MAPBOX_TOKEN}`;
    const mkA = origin ? `pin-l-a+00ffc3(${origin.lng},${origin.lat})` : null;
    const mkB = target ? `pin-l-b+00ffc3(${target.lng},${target.lat})` : null;
    const sampled = downsample(routeCoords, 80);
    const path =
      sampled.length >= 2
        ? `path-5+00ffc3-0.85(${sampled.map(([lng, lat]) => `${lng},${lat}`).join(";")})`
        : null;

    if (origin && target) {
      const overlays = [mkA, mkB, path].filter(Boolean).join(",");
      return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${overlays}/auto/800x600?logo=false&access_token=${MAPBOX_TOKEN}&ts=${Date.now()}`;
    }
    if (target && !origin) {
      const overlays = [mkB].filter(Boolean).join(",");
      return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${overlays}/${target.lng},${target.lat},12,0/800x600?logo=false&access_token=${MAPBOX_TOKEN}&ts=${Date.now()}`;
    }
    return fallback;
  }, [origin, target, routeCoords]);

  const etaText = etaSec != null ? formatETA(etaSec) : "—";
  const distText = remainMeters != null ? formatKm(remainMeters) : "—";

  useEffect(() => {
    if (!pauseActive) {
      if (pauseTimerRef.current) {
        clearInterval(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
      return;
    }
    if (pauseRemaining === null) {
      setPauseRemaining(15 * 60);
    }
    if (pauseTimerRef.current) {
      clearInterval(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    pauseTimerRef.current = setInterval(() => {
      setPauseRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (pauseTimerRef.current) {
            clearInterval(pauseTimerRef.current);
            pauseTimerRef.current = null;
          }
          setPauseActive(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (pauseTimerRef.current) {
        clearInterval(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
    };
  }, [pauseActive]);

  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const granted = await requestPermission();
      if (!granted?.granted) {
        setScanMsg("Permission caméra refusée.");
        return;
      }
    }
    setScanMsg("");
    setScannedOnce(false);
    setScanBusy(false);
    setScanVisible(true);
  };

  const handleScannedCode = (data: string) => {
    if (scannedOnce) return;
    setScannedOnce(true);
    setScanBusy(true);
    setScanMsg("Validation…");
    setTimeout(() => {
      setLiveStatus("completed");
      setScanMsg("Colis validé ✅");
      setScanBusy(false);
      setTimeout(() => setScanVisible(false), 700);
    }, 1200);
  };

  const handlePausePress = () => {
    if (pauseActive) return;
    setPauseActive(true);
    setPauseRemaining(15 * 60);
  };

  const handleResume = () => {
    setPauseActive(false);
    setPauseRemaining(null);
  };

  const formatPauseTimer = () => {
    if (!pauseRemaining) return "15:00";
    const m = Math.floor(pauseRemaining / 60);
    const s = pauseRemaining % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };
  const renderDestStage = () => (
    <SafeAreaView style={styles.pickScreen}>
      <ScrollView contentContainerStyle={styles.heroContent}>
        <View style={styles.exitRow}>
          <TouchableOpacity onPress={() => router.replace("/")}>
            <Text style={styles.backLink}>← Menu principal</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>Où souhaitez-vous aller aujourd'hui ?</Text>
        <Text style={styles.heroSubtitle}>Convecta relie les routes, vous choisissez la direction.</Text>
        <View style={{ marginTop: 20, width: "100%", gap: 12 }}>
          {DESTINATIONS.map((dest) => {
            const active = selectedDestination?.id === dest.id;
            return (
              <TouchableOpacity
                key={dest.id}
                style={[styles.destinationCard, active && styles.destinationCardActive]}
                onPress={() => setSelectedDestination(dest)}
              >
                <View style={styles.destIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.destinationLabel}>{dest.label}</Text>
                  <Text style={styles.destinationMeta}>{dest.missions}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ width: "100%", marginTop: 24 }}>
          <Text style={styles.searchLabel}>Recherche personnalisée</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Adresse ou ville (Mapbox)"
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={(t) => {
                setSearchQuery(t);
                if (!t.trim()) setSuggestions([]);
              }}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          {suggestions.length > 0 && (
            <View style={styles.suggestBox}>
              {suggestions.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.suggestItem}
                  onPress={() => {
                    setSelectedDestination({
                      id: s.id,
                      label: s.label.split(",")[0] ?? s.label,
                      missions: "Trajet personnalisé",
                      query: s.label,
                    });
                    setSearchQuery(s.label);
                    setSuggestions([]);
                  }}
                >
                  <Text style={styles.suggestText}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={[styles.primaryBtn, !selectedDestination && { opacity: 0.4 }]}
          disabled={!selectedDestination}
          onPress={() => setStage("offer")}
        >
          <Text style={styles.primaryBtnText}>DÉMARER MON VOYAGE</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const renderOfferStage = () => {
    if (!selectedDestination) {
      setStage("dest");
      return null;
    }
    return (
      <SafeAreaView style={styles.pickScreen}>
        <View style={styles.offerHeader}>
          <TouchableOpacity onPress={() => setStage("dest")}>
            <Text style={styles.backLink}>← Changer de destination</Text>
          </TouchableOpacity>
          <Text style={styles.offerTitle}>{selectedDestination.label}</Text>
          <Text style={styles.offerSubtitle}>{selectedDestination.missions}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
          {OFFER_PRESETS.map((offer) => {
            const active = selectedOffer?.id === offer.id;
            return (
              <TouchableOpacity
                key={offer.id}
                style={[styles.offerCard, active && styles.offerCardActive]}
                onPress={() => setSelectedOffer(offer)}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={styles.offerCardTitle}>{offer.title}</Text>
                  <Text style={styles.offerHourly}>{offer.hourly}</Text>
                </View>
                <Text style={styles.offerDescription}>{offer.description}</Text>
                <View style={styles.offerMetaRow}>
                  <Text style={styles.offerMeta}>Durée estimée : {offer.duration}</Text>
                  <Text style={styles.offerMeta}>Distance : {offer.distance}</Text>
                </View>
                <Text style={styles.offerBonus}>{offer.bonus} de bonus potentiel</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.ctaBar}>
          <TouchableOpacity
            style={[styles.primaryBtn, !selectedOffer && { opacity: 0.4 }]}
            disabled={!selectedOffer}
            onPress={handleAcceptOffer}
          >
            <Text style={styles.primaryBtnText}>ACCEPTER L’ITINÉRAIRE</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  };

  const renderLiveStage = () => (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#030712" }}>
      <View style={styles.liveHeader}>
        <TouchableOpacity onPress={goBackToDest}>
          <Text style={styles.backLink}>← Itinéraires</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace("/")}>
          <Text style={styles.backLink}>Quitter</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.liveTitleWrap}>
        <Text style={styles.liveTitle}>{destLabel}</Text>
        <Text style={styles.liveSubtitle}>{selectedOffer?.title}</Text>
      </View>

      <View style={styles.mapContainer}>
        {(!target || loading) ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={styles.centerText}>Préparation de l'itinéraire…</Text>
          </View>
        ) : HAS_MAPBOX && origin ? (
          <MapboxGL.MapView
            style={StyleSheet.absoluteFillObject}
            styleURL={MapboxGL.StyleURL.Dark}
            logoEnabled={false}
            attributionEnabled={false}
          >
            <MapboxGL.Camera
              centerCoordinate={[origin.lng, origin.lat]}
              zoomLevel={remainMeters != null && remainMeters < 30 ? 18 : 12.5}
              animationMode="flyTo"
              animationDuration={700}
            />
            <MapboxGL.UserLocation visible requestsAlwaysUse={false} showsUserHeadingIndicator />
            {routeCoords.length > 1 && (
              <MapboxGL.ShapeSource
                id="route"
                shape={{ type: "Feature", geometry: { type: "LineString", coordinates: routeCoords }, properties: {} }}
              >
                <MapboxGL.LineLayer
                  id="route-line"
                  style={{
                    lineWidth: 6,
                    lineColor: "#00ffc3",
                    lineCap: "round",
                    lineJoin: "round",
                    lineBlur: 0.7,
                  }}
                />
              </MapboxGL.ShapeSource>
            )}
          </MapboxGL.MapView>
        ) : (
          staticMapUrl && <Image source={{ uri: staticMapUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        )}

        <View style={styles.liveOverlay}>
          <Text style={styles.overlayTitle}>{origin ? "Trajet en cours" : "Analyse écologique"}</Text>
          <View style={styles.overlayRow}>
            <Text style={styles.overlayLabel}>Heure d’arrivée</Text>
            <Text style={styles.overlayValue}>{etaText}</Text>
          </View>
          <View style={styles.overlayRow}>
            <Text style={styles.overlayLabel}>Distance restante</Text>
            <Text style={styles.overlayValue}>{distText}</Text>
          </View>
          <View style={styles.overlayRow}>
            <Text style={styles.overlayLabel}>Rémunération</Text>
            <Text style={styles.overlayValue}>{selectedOffer?.hourly ?? "—"}</Text>
          </View>
          <View style={styles.overlayRow}>
            <Text style={styles.overlayLabel}>Bonus estimé</Text>
            <Text style={styles.overlayValue}>{selectedOffer?.bonus ?? "—"}</Text>
          </View>
          {nextStep && (
          <Text style={styles.overlayHint}>
            Prochaine étape : {nextStep.instruction} ({formatKm(nextStep.distance)} · {formatETA(nextStep.duration)})
          </Text>
        )}
        <TouchableOpacity style={styles.scanButton} onPress={handleOpenScanner}>
            <Text style={styles.scanButtonIcon}>📷</Text>
            <View>
              <Text style={styles.scanButtonTitle}>
                {liveStatus === "completed" ? "Colis validés" : "Scanner un colis"}
              </Text>
              <Text style={styles.scanButtonSubtitle}>
                {liveStatus === "completed" ? "QR confirmé" : "Flasher pour confirmer"}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.controlCard}>
            <View style={styles.controlRow}>
              <View>
                <Text style={styles.controlTitle}>Pause éco</Text>
                <Text style={styles.controlSubtitle}>
                  {pauseActive ? `Temps restant ${formatPauseTimer()}` : "15 min maximum"}
                </Text>
              </View>
              {pauseActive ? (
                <TouchableOpacity style={styles.resumeBtn} onPress={handleResume}>
                  <Text style={styles.resumeBtnText}>Continuer</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.pauseBtn, pauseActive && { opacity: 0.3 }]}
                  onPress={handlePausePress}
                  disabled={pauseActive}
                >
                  <Text style={styles.pauseBtnText}>Pause</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={styles.controlCard}>
            <Text style={styles.controlTitle}>Stop exceptionnel</Text>
            <TouchableOpacity
              style={styles.dropdownControl}
              onPress={() => setStopPickerOpen((prev) => !prev)}
            >
              <Text style={styles.dropdownValue}>
                {stopReason ?? "Sélectionner un motif"}
              </Text>
              <Text style={styles.dropdownCaret}>{stopPickerOpen ? "▲" : "▼"}</Text>
            </TouchableOpacity>
            {stopPickerOpen && (
              <View style={styles.dropdownList}>
                {STOP_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={styles.dropdownOption}
                    onPress={() => {
                      setStopReason(reason);
                      setStopPickerOpen(false);
                    }}
                  >
                    <Text style={styles.dropdownOptionText}>{reason}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {stopReason && (
              <Text style={styles.controlSubtitle}>Motif sélectionné : {stopReason}</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            <Text style={styles.footerLabel}>Destination</Text>
            <Text style={styles.footerValue}>{destAddress}</Text>
          </>
        )}
        <TouchableOpacity style={styles.secondaryBtn} onPress={goBackToDest}>
          <Text style={styles.secondaryBtnText}>Changer d’itinéraire</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={scanVisible} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.scanModal}>
          <View style={styles.scanHeader}>
            <Text style={styles.scanTitle}>Scanner le QR</Text>
            <TouchableOpacity onPress={() => setScanVisible(false)}>
              <Text style={styles.scanClose}>Fermer ✕</Text>
            </TouchableOpacity>
          </View>
          {permission && !permission.granted ? (
            <View style={styles.scanMessageBox}>
              <Text style={styles.scanMessage}>Permission caméra refusée. Autorise-la dans les réglages.</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
                <Text style={styles.primaryBtnText}>Autoriser</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.scannerFrame}>
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={scannedOnce ? undefined : ({ data }) => handleScannedCode(data)}
                />
                <View style={styles.scanHintOverlay}>
                  <Text style={styles.scanHintText}>Place le QR dans le cadre</Text>
                </View>
              </View>
              <View style={styles.scanFooter}>
                {scanMsg ? <Text style={styles.scanMessage}>{scanMsg}</Text> : null}
                {scanBusy && <ActivityIndicator color={Colors.accent} />}
              </View>
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );

  if (stage === "offer") return renderOfferStage();
  if (stage === "live") return renderLiveStage();
  return renderDestStage();
}

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
  pickScreen: {
    flex: 1,
    backgroundColor: "#030712",
  },
  heroContent: {
    padding: 24,
    paddingBottom: 40,
    alignItems: "center",
  },
  exitRow: { alignSelf: "stretch", alignItems: "flex-start", marginBottom: 12 },
  heroTitle: { color: Colors.text, fontSize: 26, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  heroSubtitle: { color: Colors.textSecondary, fontSize: 15, textAlign: "center" },
  destinationCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  destinationCardActive: {
    borderColor: Colors.accent,
    backgroundColor: "#1a2632",
  },
  destIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    opacity: 0.7,
  },
  destinationLabel: { color: Colors.text, fontSize: 17, fontWeight: "700" },
  destinationMeta: { color: Colors.textSecondary },
  searchLabel: { color: Colors.textSecondary, fontWeight: "600", marginBottom: 8, marginTop: 12 },
  searchRow: { flexDirection: "row", alignItems: "center" },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.input,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
  },
  suggestBox: { backgroundColor: Colors.card, borderRadius: 12, marginTop: 8, overflow: "hidden" },
  suggestItem: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  suggestText: { color: Colors.text },
  ctaBar: { padding: 20 },
  primaryBtn: {
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
  },
  primaryBtnText: { color: Colors.background, fontWeight: "800", letterSpacing: 0.5 },
  offerHeader: { padding: 24, paddingBottom: 12 },
  backLink: { color: Colors.accent, fontSize: 14, marginBottom: 8 },
  offerTitle: { color: Colors.text, fontSize: 22, fontWeight: "700" },
  offerSubtitle: { color: Colors.textSecondary, marginTop: 2 },
  offerCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 6,
  },
  offerCardActive: {
    borderColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  offerCardTitle: { color: Colors.text, fontSize: 18, fontWeight: "700" },
  offerHourly: { color: Colors.accent, fontSize: 16, fontWeight: "700" },
  offerDescription: { color: Colors.textSecondary },
  offerMetaRow: { flexDirection: "row", justifyContent: "space-between" },
  offerMeta: { color: Colors.textSecondary },
  offerBonus: { color: Colors.text, fontWeight: "600", marginTop: 4 },
  liveHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  liveTitleWrap: { paddingHorizontal: 20, paddingBottom: 8 },
  liveTitle: { color: Colors.text, fontSize: 20, fontWeight: "700" },
  liveSubtitle: { color: Colors.textSecondary, fontSize: 14 },
  mapContainer: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#0f172a" },
  liveOverlay: {
    position: "absolute",
    right: 16,
    top: 16,
    backgroundColor: "rgba(3,7,18,0.85)",
    borderRadius: 16,
    padding: 16,
    width: 220,
    gap: 6,
  },
  controlCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(10,15,25,0.92)",
    gap: 8,
  },
  controlRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  controlTitle: { color: Colors.text, fontWeight: "700" },
  controlSubtitle: { color: Colors.textSecondary, fontSize: 12 },
  pauseBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  pauseBtnText: { color: Colors.background, fontWeight: "700" },
  resumeBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resumeBtnText: { color: Colors.accent, fontWeight: "700" },
  scanButton: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.accent,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scanButtonIcon: { fontSize: 20 },
  scanButtonTitle: { color: Colors.text, fontWeight: "700" },
  scanButtonSubtitle: { color: Colors.textSecondary, fontSize: 12 },
  dropdownControl: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.card,
  },
  dropdownValue: { color: Colors.text, flex: 1 },
  dropdownCaret: { color: Colors.textSecondary, marginLeft: 8 },
  dropdownList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.card,
  },
  dropdownOption: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  dropdownOptionText: { color: Colors.text },
  overlayTitle: { color: Colors.accent, fontWeight: "700", marginBottom: 4 },
  overlayRow: { flexDirection: "row", justifyContent: "space-between" },
  overlayLabel: { color: Colors.textSecondary, fontSize: 12 },
  overlayValue: { color: Colors.text, fontWeight: "600" },
  overlayHint: { color: Colors.textSecondary, marginTop: 6, fontSize: 12 },
  footer: { padding: 20, gap: 8, backgroundColor: "#030712" },
  footerLabel: { color: Colors.textSecondary, fontSize: 12 },
  footerValue: { color: Colors.text, fontSize: 16, fontWeight: "600" },
  errorText: { color: "#ff6b6b" },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  secondaryBtnText: { color: Colors.accent, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerText: { color: Colors.text, marginTop: 8 },
  scanModal: { flex: 1, backgroundColor: Colors.background, padding: 16, paddingTop: 48, gap: 12 },
  scanHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scanTitle: { color: Colors.text, fontSize: 18, fontWeight: "700" },
  scanClose: { color: Colors.textSecondary, fontWeight: "600" },
  scanMessageBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  scanMessage: { color: Colors.text, textAlign: "center" },
  scannerFrame: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scanHintOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
  },
  scanHintText: { color: Colors.text, fontWeight: "600" },
  scanFooter: { paddingVertical: 16, alignItems: "center", gap: 8 },
});
