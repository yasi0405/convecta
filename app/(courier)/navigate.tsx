// app/(courier)/navigate.tsx
import { IconSymbol } from "@/components/ui/IconSymbol";
import Colors from "@/theme/Colors";
import { ensureAmplifyConfigured } from "@/lib/amplify";
import type { Schema } from "@amplify/data/resource";
import MapboxGL from "@rnmapbox/maps";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

ensureAmplifyConfigured();

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN as string;
const HAS_MAPBOX = Platform.OS !== "web" && !!(MapboxGL as any)?.MapView && !!MAPBOX_TOKEN;
if (HAS_MAPBOX && MAPBOX_TOKEN) {
  MapboxGL.setAccessToken(MAPBOX_TOKEN);
}
const client = generateClient<Schema>();
const AVERAGE_SPEED_KMH = 35;
const SPEED_MPS = (AVERAGE_SPEED_KMH * 1000) / 3600;

const DESTINATIONS: Destination[] = [
  {
    id: "brussels",
    label: "Bruxelles",
    missions: "15 missions disponibles",
    query: "Bruxelles, Belgique",
    coords: { lat: 50.8503, lng: 4.3517 },
  },
  {
    id: "lille",
    label: "Lille",
    missions: "8 missions disponibles",
    query: "Lille, France",
    coords: { lat: 50.6292, lng: 3.0573 },
  },
  {
    id: "charleroi",
    label: "Charleroi",
    missions: "3 livraisons express",
    query: "Charleroi, Belgique",
    coords: { lat: 50.4108, lng: 4.4446 },
  },
  {
    id: "loop",
    label: "Pas de destination précise",
    missions: "Je me laisse guider",
    query: "",
    coords: null,
  },
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

const LOOP_HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => i); // 0h → 12h
const LOOP_MINUTE_OPTIONS = [0, 15, 30, 45];
const LOOP_PICKER_ITEM_HEIGHT = 48;
const LOOP_PICKER_HEIGHT = 220;
const LOOP_PICKER_PADDING = (LOOP_PICKER_HEIGHT - LOOP_PICKER_ITEM_HEIGHT) / 2;

type Stage = "dest" | "offer" | "live";
type Destination = {
  id: string;
  label: string;
  missions: string;
  query: string;
  coords?: Coords | null;
};
type Offer = typeof OFFER_PRESETS[number];
type Coords = { lat: number; lng: number };

type Step = { instruction: string; distance: number; duration: number };
type LocationSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  placeName: string;
  coords: Coords;
};

const extractParcels = (payload: any): any[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.filter(Boolean);
  if (Array.isArray(payload?.data)) return payload.data.filter(Boolean);
  const candidate =
    payload?.data?.listParcels?.items ??
    payload?.listParcels?.items ??
    payload?.data?.items ??
    payload?.items ??
    [];
  return Array.isArray(candidate) ? candidate.filter(Boolean) : [];
};

export default function CourierNavigate() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("dest");
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [destLabel, setDestLabel] = useState<string | null>(null);
  const [destAddress, setDestAddress] = useState<string | null>(null);

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
  const [parcelSyncLoading, setParcelSyncLoading] = useState(false);
  const [parcelSyncError, setParcelSyncError] = useState<string | null>(null);
  const [activeParcel, setActiveParcel] = useState<{
    id: string;
    adresseDepart?: string | null;
    adresseArrivee?: string | null;
    status?: string | null;
    type?: string | null;
  } | null>(null);
  const [deliveryPhase, setDeliveryPhase] = useState<"pickup" | "dropoff">("pickup");
  const [parcelWaypoints, setParcelWaypoints] = useState<{ pickup: Coords | null; dropoff: Coords | null } | null>(null);
  const [courierId, setCourierId] = useState<string | null>(null);
  const [startConfirmVisible, setStartConfirmVisible] = useState(false);
  const startConfirmDurationRef = useRef<number | null>(null);
  const [liveTicker, setLiveTicker] = useState(0);
  const [loopModalVisible, setLoopModalVisible] = useState(false);
  const [loopDuration, setLoopDuration] = useState<number | null>(null);
  const [loopSelection, setLoopSelection] = useState<number>(60);
  const [stopConfirmVisible, setStopConfirmVisible] = useState(false);
  const hourListRef = useRef<FlatList<number> | null>(null);
  const minuteListRef = useRef<FlatList<number> | null>(null);
  const loopIntentRef = useRef<"stay" | "toOffer" | "toLive">("stay");
  const [customQuery, setCustomQuery] = useState("");
  const [customResults, setCustomResults] = useState<LocationSuggestion[]>([]);
  const [customSearchLoading, setCustomSearchLoading] = useState(false);
  const [customSearchError, setCustomSearchError] = useState<string | null>(null);
  const [previewRoute, setPreviewRoute] = useState<[number, number][]>([]);
  const [previewBounds, setPreviewBounds] = useState<{ ne: [number, number]; sw: [number, number] } | null>(null);
  const [previewLineWidth, setPreviewLineWidth] = useState(10);

const scrollPickersTo = (value: number, animated = true) => {
  const hoursVal = Math.floor(value / 60);
  const minutesVal = value % 60;
  const minuteIdx = Math.max(0, LOOP_MINUTE_OPTIONS.indexOf(minutesVal));
  hourListRef.current?.scrollToOffset({ offset: LOOP_PICKER_ITEM_HEIGHT * hoursVal, animated });
  minuteListRef.current?.scrollToOffset({ offset: LOOP_PICKER_ITEM_HEIGHT * minuteIdx, animated });
};

const enforceLoopSelection = (hours: number, minutes: number) => {
  let safeHours = Math.min(12, Math.max(0, hours));
  let safeMinutes = LOOP_MINUTE_OPTIONS.includes(minutes) ? minutes : 0;

  if (safeHours === 12 && safeMinutes > 0) {
    safeMinutes = 0;
  }
  if (safeHours === 0 && safeMinutes === 0) {
    safeMinutes = 15;
  }

  const normalized = safeHours * 60 + safeMinutes;
  const clamped = Math.min(12 * 60, Math.max(15, normalized));
  setLoopSelection(clamped);

  const adjusted =
    safeHours !== hours || safeMinutes !== minutes || clamped !== normalized;
  if (adjusted) {
    scrollPickersTo(clamped, true);
  }

  return clamped;
};

const handleHourMomentum = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
  const index = Math.round(event.nativeEvent.contentOffset.y / LOOP_PICKER_ITEM_HEIGHT);
  const safeIndex = Math.min(LOOP_HOUR_OPTIONS.length - 1, Math.max(0, index));
  const hoursValue = LOOP_HOUR_OPTIONS[safeIndex];
  const minutesValue = loopSelection % 60;
  enforceLoopSelection(hoursValue, minutesValue);
};

const handleMinuteMomentum = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
  const index = Math.round(event.nativeEvent.contentOffset.y / LOOP_PICKER_ITEM_HEIGHT);
  const safeIndex = Math.min(LOOP_MINUTE_OPTIONS.length - 1, Math.max(0, index));
  const minutesValue = LOOP_MINUTE_OPTIONS[safeIndex];
  const hoursValue = Math.floor(loopSelection / 60);
  enforceLoopSelection(hoursValue, minutesValue);
};

const loopHoursValue = Math.floor(loopSelection / 60);
const loopMinutesValue = loopSelection % 60;
const loopMinutesIndex = Math.max(0, LOOP_MINUTE_OPTIONS.indexOf(loopMinutesValue));

  const resetLiveData = () => {
    setOrigin(null);
    setTarget(null);
    setEtaSec(null);
    setRemainMeters(null);
    setNextStep(null);
    setRouteCoords([]);
    setError(null);
    setParcelSyncLoading(false);
    setParcelSyncError(null);
    setActiveParcel(null);
    setParcelWaypoints(null);
    setDeliveryPhase("pickup");
    setLiveStatus("ongoing");
    setPauseActive(false);
    setPauseRemaining(null);
    setStopReason(null);
    setStopPickerOpen(false);
    setLiveTicker(0);
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
    setStartConfirmVisible(false);
    startConfirmDurationRef.current = null;
  };

  const openLoopModal = useCallback(
    (intent: "stay" | "toOffer" | "toLive" = "stay", fallbackSelection?: number | null) => {
      loopIntentRef.current = intent;
      setLoopSelection((prev) => {
        if (typeof fallbackSelection === "number") return fallbackSelection;
        return loopDuration ?? prev;
      });
      setLoopModalVisible(true);
    },
    [loopDuration]
  );

  const closeLoopModal = useCallback(() => {
    setLoopModalVisible(false);
    loopIntentRef.current = "stay";
  }, []);

  const handleCustomDestinationSelect = useCallback(
    (suggestion: LocationSuggestion) => {
      const customDestination: Destination = {
        id: `custom-${suggestion.id}`,
        label: suggestion.title,
        missions: suggestion.subtitle || "Adresse personnalisée",
        query: suggestion.placeName,
        coords: suggestion.coords,
      };
      setSelectedDestination(customDestination);
      setCustomQuery(suggestion.placeName);
      setCustomResults([]);
      setCustomSearchError(null);
      setLoopDuration(null);
      closeLoopModal();
    },
    [closeLoopModal]
  );

  const handleParcelErrorDismiss = () => {
    setParcelSyncError(null);
    goBackToDest();
  };

  const findAvailableParcelAlongRoute = useCallback(async () => {
    if (!courierId) return null;
    const anchors: Coords[] = [];
    if (routeCoords?.length) anchors.push(...routeCoords.map(([lng, lat]) => ({ lat, lng })));
    if (previewRoute?.length) anchors.push(...previewRoute.map(([lng, lat]) => ({ lat, lng })));
    if (selectedDestination?.coords) anchors.push(selectedDestination.coords);
    if (origin) anchors.push(origin);
    if (!anchors.length) return null;

    try {
      setParcelSyncLoading(true);
      const res = await client.models.Parcel.list(
        {
          filter: { status: { eq: "AVAILABLE" } },
          limit: 100,
          authMode: "userPool",
        } as any
      );
      const candidates = extractParcels(res);
      let best: any = null;
      let bestDistKm = Infinity;

      for (const item of candidates) {
        const pickupAddress = item?.adresseDepart?.trim?.();
        const dropoffAddress = item?.adresseArrivee?.trim?.();
        if (!pickupAddress || !dropoffAddress) continue;
        const geoPickup = await geocodePlaces(pickupAddress);
        const coord = geoPickup?.[0]?.coords;
        if (!coord) continue;
        const distKm = anchors.reduce((min, pt) => Math.min(min, distanceBetween(pt, coord)), Infinity);
        if (distKm < bestDistKm) {
          best = item;
          bestDistKm = distKm;
        }
      }

      // Plan A: colis à moins de 5 km du trajet actuel
      if (best && bestDistKm <= 5) {
        try {
          await client.models.Parcel.update(
            {
              id: best.id,
              assignedTo: courierId,
              status: "ASSIGNED",
              updatedAt: new Date().toISOString(),
            } as any,
            { authMode: "userPool" }
          );
        } catch (e) {
          console.log("Auto-assign available parcel (corridor) failed:", e);
        }
        return best;
      }

      // Plan B: alternative trajet, accepte un détour raisonnable (<= 15 km du trajet ou départ)
      if (best && bestDistKm <= 15) {
        try {
          await client.models.Parcel.update(
            {
              id: best.id,
              assignedTo: courierId,
              status: "ASSIGNED",
              updatedAt: new Date().toISOString(),
            } as any,
            { authMode: "userPool" }
          );
        } catch (e) {
          console.log("Auto-assign available parcel (detour) failed:", e);
        }
        return best;
      }
    } catch (e) {
      console.log("findAvailableParcelAlongRoute error:", e);
    } finally {
      setParcelSyncLoading(false);
    }
    return null;
  }, [courierId, origin, previewRoute, routeCoords, selectedDestination]);

  const fetchActiveParcel = useCallback(async () => {
    if (!courierId) return null;
    try {
      setParcelSyncLoading(true);
      setParcelSyncError(null);
      const res = await client.models.Parcel.list({
        filter: {
          assignedTo: { eq: courierId },
          or: [
            { status: { eq: "ASSIGNED" } },
            { status: { eq: "IN_PROGRESS" } },
            { status: { eq: "DELIVERING" } },
          ],
        },
        limit: 50,
        authMode: "userPool",
      } as any);
      const parcels = extractParcels(res);
      const parcel = parcels.find((p: any) => p?.id);
      if (!parcel) {
        const available = await findAvailableParcelAlongRoute();
        if (available) {
          setActiveParcel(available);
          return available;
        }
        setParcelSyncError(
          "Aucun colis disponible automatiquement sur ton trajet pour le moment. Nous attribuons les colis proches de ton itinéraire : ajuste ta destination ou réessaie dans un instant."
        );
        return null;
      }
      setActiveParcel(parcel);
      return parcel;
    } catch (error) {
      setParcelSyncError("Impossible de récupérer tes colis assignés.");
      return null;
    } finally {
      setParcelSyncLoading(false);
    }
  }, [courierId, findAvailableParcelAlongRoute]);

  const ensureParcelWaypoints = useCallback(
    async (parcel: { adresseDepart?: string | null; adresseArrivee?: string | null }) => {
      const pickupAddress = parcel.adresseDepart?.trim();
      const dropoffAddress = parcel.adresseArrivee?.trim();
      if (!pickupAddress || !dropoffAddress) {
        setParcelSyncError("Les adresses du colis sont incomplètes.");
        return null;
      }
      if (parcelWaypoints?.pickup && parcelWaypoints?.dropoff) {
        return parcelWaypoints;
      }
      try {
        setParcelSyncLoading(true);
        const [pickupResults, dropoffResults] = await Promise.all([
          geocodePlaces(pickupAddress),
          geocodePlaces(dropoffAddress),
        ]);
        const pickup = pickupResults?.[0]?.coords ?? null;
        const dropoff = dropoffResults?.[0]?.coords ?? null;
        if (!pickup || !dropoff) {
          setParcelSyncError("Impossible de localiser les adresses du colis.");
          return null;
        }
        const coords = { pickup, dropoff };
        setParcelWaypoints(coords);
        return coords;
      } catch (error) {
        setParcelSyncError("Erreur lors de la localisation des adresses du colis.");
        return null;
      } finally {
        setParcelSyncLoading(false);
      }
    },
    [parcelWaypoints]
  );

  const handleAcceptOffer = () => {
    if (!selectedDestination || !selectedOffer) return;
    if (selectedDestination.id === "loop" && !loopDuration) {
      openLoopModal("toLive");
      return;
    }
    const durationOverride = selectedDestination.id === "loop" ? loopDuration ?? loopSelection : undefined;
    requestStartConfirmation(durationOverride);
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

  useEffect(() => {
    if (stage !== "live") {
      setLiveTicker(0);
      return;
    }
    setLiveTicker(0);
    const interval = setInterval(() => {
      setLiveTicker((tick) => tick + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [stage]);

  // 2. Set destination coordinates without web fetch
  useEffect(() => {
    if (stage !== "live") return;
    if (parcelWaypoints) {
      const waypoint =
        deliveryPhase === "pickup" ? parcelWaypoints.pickup : parcelWaypoints.dropoff;
      if (waypoint) {
        setTarget(waypoint);
        setError(null);
        return;
      }
    }
    if (!selectedDestination) return;
    if (selectedDestination.id === "loop") {
      if (origin) setTarget(origin);
      return;
    }
    if (selectedDestination.coords) {
      setTarget(selectedDestination.coords);
      setError(null);
      return;
    }
    setTarget(null);
    setError("Destination indisponible sans coordonnées pré-configurées.");
  }, [stage, parcelWaypoints, deliveryPhase, selectedDestination, origin]);

  // 3. Directions polling (local estimation only)
  useEffect(() => {
    if (stage !== "live" || !target) return;
    let cancelled = false;

    const updateRoute = async () => {
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
        if (!current || cancelled) return;

        setOrigin(current);

        const distKm = distanceBetween(current, target);
        const fallbackMeters = Math.max(0, Math.round(distKm * 1000));
        const fallbackEtaSeconds = Math.max(0, Math.round((distKm / AVERAGE_SPEED_KMH) * 3600));
        const fallbackStep: Step = {
          instruction: fallbackMeters < 200 ? "Arrivée imminente" : "Continuer vers la destination",
          distance: fallbackMeters,
          duration: fallbackEtaSeconds,
        };

        let mapboxRoute: Awaited<ReturnType<typeof fetchMapboxDirections>> = null;
        if (!cancelled) {
          mapboxRoute = await fetchMapboxDirections(current, target);
        }
        if (cancelled) return;

        const coords = (() => {
          const raw = Array.isArray(mapboxRoute?.coordinates) ? mapboxRoute.coordinates : [];
          const normalized = raw
            .map((c: any) =>
              Array.isArray(c) && c.length >= 2 ? [Number(c[0]), Number(c[1])] as [number, number] : null,
            )
            .filter(Boolean) as [number, number][];
          if (normalized.length > 1) return normalized;
          return [
            [current.lng, current.lat],
            [target.lng, target.lat],
          ] as [number, number][];
        })();

        const meters =
          mapboxRoute && Number.isFinite(mapboxRoute.distance)
            ? Math.max(0, Math.round(mapboxRoute.distance))
            : fallbackMeters;

        const etaSeconds =
          mapboxRoute && Number.isFinite(mapboxRoute.duration)
            ? Math.max(0, Math.round(mapboxRoute.duration))
            : fallbackEtaSeconds;

        const nextStepData = mapboxRoute?.nextStep ?? fallbackStep;

        setRouteCoords(coords);
        setRemainMeters(meters);
        setEtaSec(etaSeconds);
        setNextStep(nextStepData);
        setLiveTicker(0);
      } catch (e) {
        console.log("updateRoute error:", e);
      }
    };

    updateRoute();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(updateRoute, 15000);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [stage, target]);

  const elapsedSinceRoute = stage === "live" ? liveTicker : 0;
  const liveEtaSec = etaSec != null ? Math.max(0, etaSec - elapsedSinceRoute) : null;
  const liveDistMeters =
    remainMeters != null ? Math.max(0, remainMeters - SPEED_MPS * elapsedSinceRoute) : null;
  const etaText = liveEtaSec != null ? formatETA(liveEtaSec) : "—";
  const distText = liveDistMeters != null ? formatKm(liveDistMeters) : "—";

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
    const parcel = activeParcel ?? (await fetchActiveParcel());
    if (!parcel) {
      Alert.alert(
        "Aucun colis",
        "Aucune attribution automatique n'est disponible sur ton trajet pour le moment. Ajuste l'itinéraire ou réessaie dans quelques minutes."
      );
      return;
    }
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

  const handleScannedCode = async (data: string) => {
    if (scannedOnce || !activeParcel?.id) return;
    setScannedOnce(true);
    setScanBusy(true);
    setScanMsg("Validation…");
    try {
      const nextStatus = deliveryPhase === "pickup" ? "IN_PROGRESS" : "DELIVERED";
      await client.models.Parcel.update({
        id: activeParcel.id,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
        authMode: "userPool",
      } as any);
      if (deliveryPhase === "pickup") {
        setDeliveryPhase("dropoff");
        const dropAddress = activeParcel.adresseArrivee ?? destAddress;
        setDestAddress(dropAddress);
        setDestLabel(dropAddress ?? destLabel ?? "Livraison");
        setScanMsg("Colis récupéré ✅");
      } else {
        setScanMsg("Colis livré ✅");
        setLiveStatus("completed");
      }
    } catch (error) {
      setScanMsg("Erreur lors de la mise à jour du colis.");
      setScannedOnce(false);
      return;
    } finally {
      setScanBusy(false);
      setTimeout(() => setScanVisible(false), 700);
    }
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

  const formatDurationLabel = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m) return `${h} h ${String(m).padStart(2, "0")} min`;
    if (h) return `${h} h`;
    return `${m} min`;
  };

  const formatLoopAddressLabel = (mins?: number | null) =>
    mins ? `Boucle locale (${formatDurationLabel(mins)})` : "Boucle locale";

  const startLiveNavigation = async (_durationOverride?: number) => {
    if (!selectedDestination || !selectedOffer) return;
    const parcel = await fetchActiveParcel();
    if (!parcel) return;
    const coords = (parcelWaypoints ?? (await ensureParcelWaypoints(parcel))) ?? null;
    if (!coords?.pickup || !coords?.dropoff) return;

    const resumePhase =
      parcel.status === "IN_PROGRESS" || parcel.status === "DELIVERING" ? "dropoff" : "pickup";
    setDeliveryPhase(resumePhase);

    const addressLabel =
      resumePhase === "pickup"
        ? parcel.adresseDepart ?? selectedDestination.label
        : parcel.adresseArrivee ?? selectedDestination.label;

    setDestLabel(addressLabel ?? selectedDestination.label);
    setDestAddress(addressLabel ?? selectedDestination.label);
    setStage("live");
    setLiveStatus("ongoing");
    setTarget(resumePhase === "pickup" ? coords.pickup : coords.dropoff);
  };

  function requestStartConfirmation(durationOverride?: number) {
    startConfirmDurationRef.current =
      typeof durationOverride === "number" ? durationOverride : null;
    setStartConfirmVisible(true);
  }

  function handleConfirmStart() {
    const override =
      typeof startConfirmDurationRef.current === "number" ? startConfirmDurationRef.current : undefined;
    startConfirmDurationRef.current = null;
    setStartConfirmVisible(false);
    startLiveNavigation(override);
  }

  function handleRejectStart() {
    startConfirmDurationRef.current = null;
    setStartConfirmVisible(false);
  }

  const handleLoopConfirm = () => {
    const rounded = Math.min(12 * 60, Math.max(15, loopSelection));
    setLoopDuration(rounded);
    setLoopModalVisible(false);

    if (loopIntentRef.current === "toOffer") {
      setStage("offer");
    } else if (loopIntentRef.current === "toLive") {
      requestStartConfirmation(rounded);
    }
  };

  const handleLoopCancel = () => {
    closeLoopModal();
    if (!loopDuration) setSelectedDestination(null);
  };

  useEffect(() => {
    const coords = selectedDestination?.coords;
    if (!coords) {
      setPreviewRoute([]);
      setPreviewBounds(null);
      return;
    }

    let cancelled = false;
    const computePreview = async () => {
      const destCoord: [number, number] = [coords.lng, coords.lat];

      // ligne plus épaisse selon l'offre
      const width =
        selectedOffer?.id === "eco"
          ? 8
          : selectedOffer?.id === "balanced"
            ? 10
            : selectedOffer?.id === "max"
              ? 12
              : 10;
      setPreviewLineWidth(width);

      let start: [number, number] = [destCoord[0] - 0.25, destCoord[1] - 0.18];
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last?.coords) {
          start = [last.coords.longitude, last.coords.latitude];
        }
      } catch {
        // silent fallback
      }

      const route = await fetchMapboxDirections(
        { lat: start[1], lng: start[0] },
        { lat: destCoord[1], lng: destCoord[0] },
      );
      const routeCoords = (() => {
        const raw = Array.isArray(route?.coordinates) ? route.coordinates : [];
        const normalized = raw
          .map((c: any) =>
            Array.isArray(c) && c.length >= 2 ? [Number(c[0]), Number(c[1])] as [number, number] : null,
          )
          .filter(Boolean) as [number, number][];
        if (normalized.length > 1) return normalized;
        return [start, destCoord];
      })();

      if (cancelled) return;
      setPreviewRoute(routeCoords);

      const lngs = routeCoords.map((c) => c[0]);
      const lats = routeCoords.map((c) => c[1]);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      setPreviewBounds({
        sw: [minLng, minLat],
        ne: [maxLng, maxLat],
      });
    };

    computePreview();
    return () => {
      cancelled = true;
    };
  }, [selectedDestination, selectedOffer]);

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        const uid =
          (user as any)?.userId ??
          (user as any)?.username ??
          (user as any)?.signInDetails?.loginId ??
          null;
        setCourierId(uid);
      } catch {
        setCourierId(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loopModalVisible) return;
    const baseValue = loopDuration ?? loopSelection;
    requestAnimationFrame(() => scrollPickersTo(baseValue, false));
  }, [loopModalVisible, loopDuration, loopSelection]);

useEffect(() => {
  if (selectedDestination?.id === "loop") return;
  if (!loopModalVisible) return;
  closeLoopModal();
  }, [selectedDestination, loopModalVisible, closeLoopModal]);

useEffect(() => {
  if (stage === "dest") return;
  if (!loopModalVisible) return;
  closeLoopModal();
  }, [stage, loopModalVisible, closeLoopModal]);

useEffect(() => {
  if (stage !== "dest") return;
  if (selectedDestination?.id !== "loop") return;
  if (loopDuration !== null) return;
  if (loopModalVisible) return;
  openLoopModal("stay");
}, [stage, selectedDestination, loopDuration, loopModalVisible, openLoopModal]);

  useEffect(() => {
    if (stage !== "dest") return;
    const trimmed = customQuery.trim();
    if (!MAPBOX_TOKEN) {
      setCustomSearchError("Recherche indisponible : configurez la clé Mapbox.");
      setCustomResults([]);
      setCustomSearchLoading(false);
      return;
    }
    if (trimmed.length < 3) {
      setCustomResults([]);
      setCustomSearchLoading(false);
      setCustomSearchError(trimmed.length === 0 ? null : "Tape au moins 3 caractères.");
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setCustomSearchLoading(true);
    setCustomSearchError(null);

    const timeout = setTimeout(async () => {
      try {
        const spots = await geocodePlaces(trimmed, controller.signal);
        if (cancelled) return;
        setCustomResults(spots);
        if (!spots.length) {
          setCustomSearchError("Aucun lieu trouvé. Essaie un autre terme.");
        }
      } catch (error) {
        if (controller.signal.aborted || cancelled) return;
        setCustomSearchError("Impossible de contacter le service de géolocalisation.");
      } finally {
        if (!controller.signal.aborted && !cancelled) {
          setCustomSearchLoading(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [customQuery, stage]);
  const renderDestStage = () => {
    const ctaDisabled =
      !selectedDestination || (selectedDestination.id === "loop" && !loopDuration);

    return (
      <SafeAreaView style={styles.pickScreen} edges={["left", "right", "bottom"]}>
        <ScrollView contentContainerStyle={styles.heroContent}>
          <Text style={styles.heroTitle}>Où souhaitez-vous aller aujourd'hui ?</Text>
          <Text style={styles.heroSubtitle}>Convecta relie les routes, vous choisissez la direction.</Text>
          <View style={{ marginTop: 20, width: "100%", gap: 12 }}>
            {DESTINATIONS.map((dest) => {
              const active = selectedDestination?.id === dest.id;
              return (
                <TouchableOpacity
                  key={dest.id}
                  style={[styles.destinationCard, active && styles.destinationCardActive]}
                  onPress={() => {
                    setSelectedDestination(dest);
                    if (dest.id !== "loop") {
                      setLoopDuration(null);
                      setLoopSelection(60);
                      closeLoopModal();
                    } else {
                      const fallback = loopDuration ?? loopSelection ?? 60;
                      setLoopDuration(null);
                      openLoopModal("stay", fallback);
                    }
                  }}
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
          <View style={styles.customSearchBlock}>
            <Text style={styles.searchLabel}>Recherche personnalisée</Text>
            {MAPBOX_TOKEN ? (
              <>
                <View style={styles.searchInputRow}>
                  <IconSymbol name="magnifyingglass" size={18} color={Colors.textSecondary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Adresse, ville ou lieu"
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    value={customQuery}
                    onChangeText={setCustomQuery}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                  />
                  {customSearchLoading && <ActivityIndicator color={Colors.accent} size="small" />}
                </View>
                {customSearchError ? (
                  <Text style={styles.searchError}>{customSearchError}</Text>
                ) : (
                  <Text style={styles.searchHint}>
                    {customQuery.trim().length < 3
                      ? "Tape au moins 3 caractères"
                      : customResults.length
                        ? "Choisis un résultat ci-dessous"
                        : "Recherche en cours…"}
                  </Text>
                )}
                {customResults.length > 0 && (
                  <View style={styles.searchResults}>
                    {customResults.map((result, idx) => (
                      <TouchableOpacity
                        key={result.id}
                        style={[
                          styles.searchResultRow,
                          idx === customResults.length - 1 && styles.searchResultRowLast,
                        ]}
                        onPress={() => handleCustomDestinationSelect(result)}
                      >
                        <IconSymbol name="mappin.and.ellipse" size={18} color={Colors.accent} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.searchResultTitle}>{result.title}</Text>
                          <Text style={styles.searchResultSubtitle}>{result.subtitle}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.searchDisabled}>
                Indisponible : configurez les appels Mapbox pour activer la recherche.
              </Text>
            )}
            {selectedDestination?.id === "loop" && loopDuration && (
              <Text style={styles.loopSummary}>
                Disponibilité définie : {formatDurationLabel(loopDuration)}
              </Text>
            )}
            {selectedDestination?.id?.startsWith("custom-") && (
              <View style={styles.customSelection}>
                <IconSymbol name="checkmark.seal.fill" size={18} color={Colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.customSelectionLabel}>Destination personnalisée</Text>
                  <Text style={styles.customSelectionValue}>{selectedDestination.label}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedDestination(null);
                    setCustomQuery("");
                    setCustomResults([]);
                    setCustomSearchError(null);
                  }}
                >
                  <Text style={styles.customSelectionClear}>Réinitialiser</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
        <View style={styles.ctaBar}>
          <TouchableOpacity
            style={[styles.primaryBtn, ctaDisabled && { opacity: 0.4 }]}
            disabled={ctaDisabled}
            onPress={() => {
              if (!selectedDestination) return;
              if (selectedDestination.id === "loop" && !loopDuration) {
                openLoopModal("toOffer");
                return;
              }
              setStage("offer");
            }}
          >
            <Text style={styles.primaryBtnText}>DÉMARER MON VOYAGE</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  };

  const renderOfferStage = () => {
    if (!selectedDestination) {
      setStage("dest");
      return null;
    }
    return (
      <SafeAreaView style={styles.pickScreen} edges={["left", "right", "bottom"]}>
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
            <View style={[styles.offerHeader, { paddingHorizontal: 20 }]}>
            <TouchableOpacity onPress={() => setStage("dest")}>
              <Text style={styles.backLink}>← Changer de destination</Text>
            </TouchableOpacity>
            <Text style={styles.offerTitle}>{selectedDestination.label}</Text>
            <Text style={styles.offerSubtitle}>{selectedDestination.missions}</Text>
          </View>

          <View style={styles.previewCard}>
            <View style={styles.previewMap}>
              {HAS_MAPBOX && previewRoute.length > 1 ? (
                <MapboxGL.MapView
                  style={{ flex: 1 }}
                  styleURL={MapboxGL.StyleURL.Dark}
                  zoomEnabled={false}
                  scrollEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  compassEnabled={false}
                  logoEnabled={false}
                  attributionEnabled={false}
                >
                  {previewBounds ? (
                    <MapboxGL.Camera
                      bounds={{
                        ne: previewBounds.ne,
                        sw: previewBounds.sw,
                        paddingTop: 20,
                        paddingBottom: 20,
                        paddingLeft: 24,
                        paddingRight: 24,
                      }}
                    />
                  ) : null}
                  <MapboxGL.ShapeSource
                    id="preview-route"
                    shape={{
                      type: "Feature",
                      geometry: {
                        type: "LineString",
                        coordinates: previewRoute,
                      },
                      properties: {},
                    }}
                  >
                    <MapboxGL.LineLayer
                      id="preview-line"
                      style={{
                        lineWidth: previewLineWidth,
                        lineColor: Colors.accent,
                        lineCap: "round",
                        lineJoin: "round",
                        lineOpacity: 0.9,
                      }}
                    />
                  </MapboxGL.ShapeSource>
                </MapboxGL.MapView>
              ) : (
                <View style={[styles.previewFallback, { alignItems: "center", justifyContent: "center" }]}>
                  <ActivityIndicator color={Colors.accent} />
                  <Text style={styles.previewDotLabel}>Prévisualisation de l’itinéraire…</Text>
                </View>
              )}
            </View>
          </View>

            <View style={styles.offerGrid}>
            {OFFER_PRESETS.map((offer) => {
              const active = selectedOffer?.id === offer.id;
              return (
                <TouchableOpacity
                  key={offer.id}
                  style={[styles.offerCard, styles.offerCardFull, active && styles.offerCardActive]}
                  onPress={() => setSelectedOffer(offer)}
                >
                  <View style={styles.offerCardRow}>
                    <Text style={styles.offerCardTitle}>{offer.title}</Text>
                    <Text style={styles.offerHourly}>{offer.hourly}</Text>
                  </View>
                  <Text style={styles.offerDuration}>{offer.duration}</Text>
                  <Text style={styles.offerDescription} numberOfLines={3}>
                    {offer.description}
                  </Text>
                  <View style={styles.offerMetaRow}>
                    <Text style={styles.offerMeta}>Bonus {offer.bonus}</Text>
                    <Text style={styles.offerMeta}>{offer.distance}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            </View>
          </ScrollView>
        </View>

        <View style={[styles.ctaBar, styles.ctaBarFloating]}>
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

  const renderLiveStage = () => {
    const bonusValue =
      activeParcel?.type?.toLowerCase() === "express" ? selectedOffer?.bonus ?? "" : "";
    const nextDistance = nextStep?.distance ?? liveDistMeters ?? 0;
    const nextDuration = nextStep?.duration ?? liveEtaSec ?? 0;
    const nextStepSummary = `${formatKm(nextDistance)} · ${formatETA(nextDuration)}`;
    const routeBounds = (() => {
      const coords = routeCoords.length > 1 ? routeCoords : null;
      if (!coords) return null;
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      return { ne: [maxLng, maxLat] as [number, number], sw: [minLng, minLat] as [number, number] };
    })();

    return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#030712" }} edges={["bottom"]}>
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
            {routeBounds ? (
              <MapboxGL.Camera
                bounds={{
                  ne: routeBounds.ne,
                  sw: routeBounds.sw,
                  paddingTop: 24,
                  paddingBottom: 24,
                  paddingLeft: 24,
                  paddingRight: 24,
                }}
                animationMode="flyTo"
                animationDuration={700}
              />
            ) : (
              <MapboxGL.Camera
                centerCoordinate={[origin.lng, origin.lat]}
                zoomLevel={remainMeters != null && remainMeters < 30 ? 18 : 12.5}
                animationMode="flyTo"
                animationDuration={700}
              />
            )}
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
                    lineColor: Colors.button,
                    lineCap: "round",
                    lineJoin: "round",
                    lineBlur: 0.7,
                  }}
                />
              </MapboxGL.ShapeSource>
            )}
            {parcelWaypoints?.pickup && (
              <MapboxGL.PointAnnotation
                id="pickup-marker"
                coordinate={[parcelWaypoints.pickup.lng, parcelWaypoints.pickup.lat]}
              >
                <View style={[styles.markerBase, styles.markerPickup]}>
                  <IconSymbol name="shippingbox.fill" size={16} color={Colors.background} />
                </View>
              </MapboxGL.PointAnnotation>
            )}
            {parcelWaypoints?.dropoff && (
              <MapboxGL.PointAnnotation
                id="dropoff-marker"
                coordinate={[parcelWaypoints.dropoff.lng, parcelWaypoints.dropoff.lat]}
              >
                <View style={[styles.markerBase, styles.markerDropoff]}>
                  <IconSymbol name="house.fill" size={16} color={Colors.background} />
                </View>
              </MapboxGL.PointAnnotation>
            )}
          </MapboxGL.MapView>
        ) : (
          <View style={styles.mapFallback}>
            <Text style={styles.mapFallbackText}>Carte non disponible sur cet appareil.</Text>
          </View>
        )}

        <View style={styles.liveControlsOverlay}>
          <Text style={styles.overlayHint}>
            Prochaine étape : Continuer vers la destination ({nextStepSummary})
          </Text>
          <View style={styles.controlActionRow}>
            <TouchableOpacity
              style={styles.controlIconBtn}
              onPress={handleOpenScanner}
              accessibilityLabel="Scanner un colis"
            >
              <IconSymbol name="qrcode.viewfinder" size={22} color={Colors.accent} />
            </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlIconBtn}
                onPress={pauseActive ? handleResume : handlePausePress}
                accessibilityLabel={pauseActive ? "Reprendre la course" : "Mettre la course en pause"}
              >
                <IconSymbol name={pauseActive ? "pause.fill" : "play.fill"} size={22} color={Colors.accent} />
              </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlIconBtn}
              onPress={() => setStopPickerOpen((prev) => !prev)}
              accessibilityLabel="Déclarer un stop exceptionnel"
            >
              <IconSymbol name="stop.fill" size={22} color={Colors.accent} />
            </TouchableOpacity>
          </View>
          <Text style={styles.controlCaption}>
            Pause éco · {pauseActive ? formatPauseTimer() : "15 min maximum"}
          </Text>
          <Text style={styles.controlCaption}>
            Stop exceptionnel · {stopReason ?? "Aucun motif"}
          </Text>
          {stopPickerOpen && (
            <View style={[styles.dropdownList, { marginTop: 8 }]}>
              {STOP_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={styles.dropdownOption}
                  onPress={() => {
                    setStopReason(reason);
                    setStopPickerOpen(false);
                    setStopConfirmVisible(true);
                  }}
                >
                  <Text style={styles.dropdownOptionText}>{reason}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {parcelSyncLoading && (
            <Text style={styles.controlSubtitle}>Préparation du colis assigné…</Text>
          )}
          {activeParcel && (
            <View style={styles.autoAssignRow}>
              <IconSymbol name="cube.box.fill" size={18} color={Colors.accent} />
              <Text style={styles.controlSubtitle}>
                {deliveryPhase === "pickup"
                  ? activeParcel.adresseDepart ?? "Adresse expéditeur"
                  : activeParcel.adresseArrivee ?? "Adresse destinataire"}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.liveFooter}>
        <Text style={styles.footerLabel}>Destination</Text>
        <Text style={styles.footerValue}>{destLabel ?? destAddress ?? "—"}</Text>
        <Text style={styles.footerLabel}>Heure d’arrivée</Text>
        <Text style={styles.footerValue}>{etaText}</Text>
        <Text style={styles.footerLabel}>Distance restante</Text>
        <Text style={styles.footerValue}>{distText}</Text>
      </View>
    </SafeAreaView>
  );
};

  const renderScanModal = () => (
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
  );

  const renderStartConfirmModal = () => (
    <Modal
      visible={startConfirmVisible}
      transparent
      animationType="fade"
      onRequestClose={handleRejectStart}
    >
      <View style={styles.confirmOverlay}>
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>Attention</Text>
          <Text style={styles.confirmMessage}>
            Une fois la course acceptée, la seule façon de l'arrêter est de livrer l'objet ou déclarer un
            problème. Après trois incidents majeurs consécutifs, une période d'approbation de 3 à 4 mois sera
            nécessaire avant de reprendre les livraisons. Merci de votre compréhension.
          </Text>
          <View style={styles.confirmActions}>
            <TouchableOpacity style={[styles.confirmBtn, styles.confirmBtnSecondary]} onPress={handleRejectStart}>
              <View style={styles.confirmBtnContent}>
                <IconSymbol name="stop.fill" size={16} color={Colors.accent} />
                <Text style={styles.confirmBtnText}>Refuser</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, styles.confirmBtnPrimary]} onPress={handleConfirmStart}>
              <View style={styles.confirmBtnContent}>
                <IconSymbol name="play.fill" size={16} color={Colors.background} />
                <Text style={[styles.confirmBtnText, styles.confirmBtnTextPrimary]}>Accepter</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderParcelErrorModal = () => (
    <Modal
      visible={!!parcelSyncError}
      transparent
      animationType="fade"
      onRequestClose={handleParcelErrorDismiss}
    >
      <View style={styles.confirmOverlay}>
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>Colis requis</Text>
          <Text style={styles.confirmMessage}>
            {parcelSyncError ??
              "Aucun colis n'a pu être attribué automatiquement sur ton trajet. Modifie l'itinéraire ou réessaie dans quelques instants."}
          </Text>
          <TouchableOpacity
            style={[styles.confirmBtn, styles.confirmBtnPrimary]}
            onPress={handleParcelErrorDismiss}
          >
            <Text style={styles.confirmBtnText}>Retour course</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

const renderLoopModal = () => (
    <Modal visible={loopModalVisible} transparent animationType="fade" onRequestClose={handleLoopCancel}>
      <View style={styles.loopModalOverlay}>
        <View style={styles.loopModalCard}>
          <Text style={styles.loopTitle}>Combien de temps es-tu disponible ?</Text>
          <Text style={styles.loopSubtitle}>
            Choisis une durée par paliers de 15 minutes. Convecta bâtit la boucle idéale.
          </Text>
          <View style={styles.loopPickerWrapper}>
            <View style={styles.loopPickerHighlight} pointerEvents="none" />
            <View style={styles.loopPicker}>
              <View style={styles.loopPickerColumn}>
                <FlatList
                  ref={(ref) => {
                    hourListRef.current = ref;
                  }}
                  data={LOOP_HOUR_OPTIONS}
                  keyExtractor={(item) => item.toString()}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={LOOP_PICKER_ITEM_HEIGHT}
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingVertical: LOOP_PICKER_PADDING }}
                  getItemLayout={(_, index) => ({
                    length: LOOP_PICKER_ITEM_HEIGHT,
                    offset: LOOP_PICKER_ITEM_HEIGHT * index,
                    index,
                  })}
                  initialScrollIndex={loopHoursValue}
                  onMomentumScrollEnd={handleHourMomentum}
                  renderItem={({ item }) => {
                    const active = item === loopHoursValue;
                    return (
                      <View style={styles.loopPickerItem}>
                        <Text style={[styles.loopPickerValue, active && styles.loopPickerValueActive]}>
                          {item}
                        </Text>
                      </View>
                    );
                  }}
                />
                <Text style={styles.loopPickerUnit}>heures</Text>
              </View>
              <View style={styles.loopPickerColumn}>
                <FlatList
                  ref={(ref) => {
                    minuteListRef.current = ref;
                  }}
                  data={LOOP_MINUTE_OPTIONS}
                  keyExtractor={(item) => item.toString()}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={LOOP_PICKER_ITEM_HEIGHT}
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingVertical: LOOP_PICKER_PADDING }}
                  getItemLayout={(_, index) => ({
                    length: LOOP_PICKER_ITEM_HEIGHT,
                    offset: LOOP_PICKER_ITEM_HEIGHT * index,
                    index,
                  })}
                  initialScrollIndex={loopMinutesIndex}
                  onMomentumScrollEnd={handleMinuteMomentum}
                  renderItem={({ item }) => {
                    const active = item === loopMinutesValue;
                    return (
                      <View style={styles.loopPickerItem}>
                        <Text style={[styles.loopPickerValue, active && styles.loopPickerValueActive]}>
                          {String(item).padStart(2, "0")}
                        </Text>
                      </View>
                    );
                  }}
                />
                <Text style={styles.loopPickerUnit}>minutes</Text>
              </View>
            </View>
          </View>
          <Text style={styles.loopHint}>Sélection minimum 15 min, maximum 12 h.</Text>
          <View style={styles.loopActions}>
            <TouchableOpacity style={styles.loopCancel} onPress={handleLoopCancel}>
              <Text style={styles.loopCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.loopConfirm} onPress={handleLoopConfirm}>
              <Text style={styles.loopConfirmText}>Continuer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderStage = () => {
    if (stage === "offer") return renderOfferStage();
    if (stage === "live") return renderLiveStage();
    return renderDestStage();
  };

  return (
    <>
      {renderStage()}
      {renderLoopModal()}
      {renderScanModal()}
      {renderStartConfirmModal()}
      {renderParcelErrorModal()}
    </>
  );
}

async function fetchMapboxDirections(
  origin: Coords,
  destination: Coords,
): Promise<{ coordinates: [number, number][]; distance: number; duration: number; nextStep: Step } | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const coordinatesQuery = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesQuery}` +
      `?alternatives=false&geometries=geojson&overview=full&steps=true&language=fr&access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn("Mapbox directions HTTP error:", response.status);
      return null;
    }
    const payload = await response.json();
    const route = payload?.routes?.[0];
    if (!route) return null;

    const coordinates = Array.isArray(route.geometry?.coordinates)
      ? route.geometry.coordinates
          .map((pair: any) => (Array.isArray(pair) && pair.length >= 2 ? [Number(pair[0]), Number(pair[1])] : null))
          .filter(Boolean) as [number, number][]
      : [];

    const legs = Array.isArray(route.legs) ? route.legs : [];
    const steps = legs.flatMap((leg: any) => (Array.isArray(leg?.steps) ? leg.steps : []));
    const next = steps.find((step: any) => (step?.distance ?? 0) > 25) ?? steps[0];
    const instructionCandidate =
      typeof next?.maneuver?.instruction === "string" && next.maneuver.instruction.trim().length > 0
        ? next.maneuver.instruction.trim()
        : typeof next?.name === "string" && next.name.length > 0
          ? next.name
          : null;

    const nextStep: Step = {
      instruction: instructionCandidate ?? "Continuer vers la destination",
      distance:
        typeof next?.distance === "number"
          ? next.distance
          : typeof route.distance === "number"
            ? route.distance
            : 0,
      duration:
        typeof next?.duration === "number"
          ? next.duration
          : typeof route.duration === "number"
            ? route.duration
            : 0,
    };

    return {
      coordinates,
      distance: typeof route.distance === "number" ? route.distance : 0,
      duration: typeof route.duration === "number" ? route.duration : 0,
      nextStep,
    };
  } catch (error) {
    console.warn("Mapbox directions fetch failed:", error);
    return null;
  }
}

async function geocodePlaces(query: string, signal?: AbortSignal): Promise<LocationSuggestion[]> {
  if (!MAPBOX_TOKEN) return [];
  try {
    const encodedQuery = encodeURIComponent(query);
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json` +
      `?access_token=${encodeURIComponent(MAPBOX_TOKEN)}` +
      `&autocomplete=true&language=fr&limit=5&types=place,locality,address,poi`;
    const response = await fetch(url, { signal });
    if (!response.ok) {
      console.warn("Mapbox geocode HTTP error:", response.status);
      return [];
    }
    const payload = await response.json();
    const features: any[] = Array.isArray(payload?.features) ? payload.features : [];
    return features
      .map((feature) => {
        const center = Array.isArray(feature?.center) ? feature.center : null;
        if (!center || center.length < 2) return null;
        const coords: Coords = { lng: Number(center[0]), lat: Number(center[1]) };
        if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return null;
        const title: string =
          feature?.text ??
          feature?.place_name?.split(",")?.[0]?.trim() ??
          feature?.place_name ??
          query;

        const contextTexts = Array.isArray(feature?.context)
          ? feature.context
              .map((ctx: any) => ctx?.text)
              .filter(Boolean)
          : [];
        const subtitle =
          feature?.place_name ??
          contextTexts.join(" · ") ??
          feature?.properties?.address ??
          title;

        return {
          id: feature?.id ?? `${title}-${coords.lat}-${coords.lng}`,
          title,
          subtitle,
          placeName: feature?.place_name ?? title,
          coords,
        } as LocationSuggestion;
      })
      .filter(Boolean) as LocationSuggestion[];
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return [];
    }
    throw error;
  }
}

function distanceBetween(a: Coords, b: Coords): number {
  const R = 6371;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const lng1 = (a.lng * Math.PI) / 180;
  const lng2 = (b.lng * Math.PI) / 180;
  const dlat = lat2 - lat1;
  const dlng = lng2 - lng1;
  const sinLat = Math.sin(dlat / 2);
  const sinLng = Math.sin(dlng / 2);
  const c = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
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
  searchLabel: { color: Colors.textSecondary, fontWeight: "600", marginBottom: 4, marginTop: 12 },
  searchDisabled: { color: Colors.textSecondary, fontStyle: "italic" },
  customSearchBlock: { width: "100%", marginTop: 24, gap: 8 },
  searchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.input,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 16 },
  searchHint: { color: Colors.textSecondary, fontSize: 12 },
  searchError: { color: "#ff6b6b", fontSize: 12 },
  searchResults: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    overflow: "hidden",
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  searchResultRowLast: { borderBottomWidth: 0 },
  searchResultTitle: { color: Colors.text, fontWeight: "600" },
  searchResultSubtitle: { color: Colors.textSecondary, fontSize: 13 },
  customSelection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: "rgba(68, 222, 172, 0.12)",
    padding: 12,
    marginTop: 4,
  },
  customSelectionLabel: { color: Colors.textSecondary, fontSize: 12, textTransform: "uppercase" },
  customSelectionValue: { color: Colors.text, fontWeight: "700" },
  customSelectionClear: { color: Colors.accent, fontWeight: "600" },
  loopSummary: { color: Colors.textSecondary, marginTop: 8, fontStyle: "italic" },
  ctaBar: { padding: 20 },
  primaryBtn: {
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
  },
  primaryBtnText: { color: Colors.background, fontWeight: "800", letterSpacing: 0.5 },
  ctaBarFloating: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#050910",
    paddingBottom: 24,
  },
  offerHeader: { padding: 24, paddingBottom: 12 },
  backLink: { color: Colors.accent, fontSize: 14, marginBottom: 8 },
  offerTitle: { color: Colors.text, fontSize: 22, fontWeight: "700" },
  offerSubtitle: { color: Colors.textSecondary, marginTop: 2 },
  previewCard: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: "#101721",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  previewMap: {
    height: 190,
    borderRadius: 14,
    backgroundColor: "#121a24",
    overflow: "hidden",
  },
  previewFallback: {
    flex: 1,
    backgroundColor: "#121a24",
  },
  previewDotLabel: { color: Colors.textSecondary, fontSize: 12 },
  offerGrid: {
    paddingHorizontal: 20,
    gap: 12,
    paddingTop: 16,
  },
  offerCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 6,
  },
  offerCardFull: {
    width: "100%",
    alignSelf: "stretch",
  },
  offerCardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  offerCardActive: {
    borderColor: Colors.accent,
    boxShadow: [
      { offsetX: 0, offsetY: 6, blurRadius: 16, color: "rgba(68, 222, 172, 0.25)" },
    ],
  },
  offerCardTitle: { color: Colors.text, fontSize: 18, fontWeight: "700" },
  offerHourly: { color: Colors.accent, fontSize: 16, fontWeight: "700" },
  offerDescription: { color: Colors.textSecondary },
  offerDuration: { color: Colors.text, fontSize: 20, fontWeight: "700" },
  offerMetaRow: { flexDirection: "row", justifyContent: "space-between" },
  offerMeta: { color: Colors.textSecondary },
  offerBonus: { color: Colors.text, fontWeight: "600", marginTop: 4 },
  liveInfoBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#040a13",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  liveInfoDestination: { color: Colors.text, fontSize: 20, fontWeight: "700" },
  liveInfoStatus: { color: Colors.textSecondary, fontSize: 14, marginTop: 2 },
  liveInfoStats: { flexDirection: "row", flexWrap: "wrap", marginTop: 12, gap: 16 },
  liveInfoStat: { flexBasis: "45%" },
  liveInfoLabel: { color: Colors.textSecondary, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  liveInfoValue: { color: Colors.text, fontSize: 16, fontWeight: "600", marginTop: 2 },
  mapContainer: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#0f172a" },
  mapFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#050b19",
  },
  mapFallbackText: { color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 20 },
  liveControlsOverlay: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: "rgba(3,7,18,0.85)",
    borderRadius: 16,
    padding: 16,
    width: 220,
    gap: 6,
  },
  controlSubtitle: { color: Colors.textSecondary, fontSize: 12 },
  controlActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
  },
  controlIconBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(68,222,172,0.08)",
  },
  controlCaption: { color: Colors.textSecondary, fontSize: 12 },
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
  autoAssignRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(10,15,25,0.92)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  markerBase: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  markerPickup: {
    backgroundColor: Colors.accent,
  },
  markerDropoff: {
    backgroundColor: Colors.card,
  },
  overlayHint: { color: Colors.textSecondary, marginBottom: 6, fontSize: 12 },
  liveFooter: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: "#040a13",
    gap: 6,
  },
  footerLabel: { color: Colors.textSecondary, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  footerValue: { color: Colors.text, fontSize: 16, fontWeight: "700" },
  errorText: { color: "#ff6b6b" },
  errorTextSmall: { color: "#ff6b6b", fontSize: 12 },
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
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confirmCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  confirmTitle: { color: Colors.text, fontSize: 20, fontWeight: "700" },
  confirmMessage: { color: Colors.textSecondary, lineHeight: 20 },
  confirmActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    borderWidth: 1,
  },
  confirmBtnSecondary: { borderColor: Colors.border, backgroundColor: Colors.input },
  confirmBtnPrimary: { borderColor: Colors.accent, backgroundColor: Colors.accent },
  confirmBtnContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  confirmBtnText: { color: Colors.text, fontWeight: "700", fontSize: 16 },
  confirmBtnTextPrimary: { color: Colors.background },
  loopModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loopModalCard: {
    backgroundColor: Colors.card,
    padding: 20,
    borderRadius: 16,
    width: "100%",
    gap: 12,
  },
  loopTitle: { color: Colors.text, fontSize: 18, fontWeight: "700" },
  loopSubtitle: { color: Colors.textSecondary, fontSize: 14 },
  loopPickerWrapper: {
    width: "100%",
    marginTop: 8,
    position: "relative",
    height: LOOP_PICKER_HEIGHT,
  },
  loopPicker: { flexDirection: "row", flex: 1, gap: 16, paddingHorizontal: 8 },
  loopPickerHighlight: {
    position: "absolute",
    left: 8,
    right: 8,
    top: LOOP_PICKER_PADDING,
    height: LOOP_PICKER_ITEM_HEIGHT,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: "rgba(68, 222, 172, 0.08)",
  },
  loopPickerColumn: { flex: 1, alignItems: "center" },
  loopPickerItem: {
    height: LOOP_PICKER_ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  loopPickerValue: { color: Colors.textSecondary, fontSize: 30, fontWeight: "600" },
  loopPickerValueActive: { color: Colors.accent, fontSize: 36, fontWeight: "700" },
  loopPickerUnit: {
    color: Colors.textSecondary,
    marginTop: 8,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  loopHint: { color: Colors.textSecondary, textAlign: "center" },
  loopActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  loopCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  loopCancelText: { color: Colors.textSecondary },
  loopConfirm: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  loopConfirmText: { color: Colors.background, fontWeight: "700" },
});
