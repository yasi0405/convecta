import { useEffect, useMemo, useState } from "react";
import type { Feature, FeatureCollection, LineString, Polygon } from "geojson";
import { lineString, point } from "@turf/helpers";
import buffer from "@turf/buffer";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN!;

export type LonLat = [number, number]; // [lng, lat]

export type Parcel = {
  id: string;
  pickup: LonLat;
  dropoff: LonLat;
  amount: number; // montant en €
};

export type FlexCorridorConfig = {
  id: string; // 'precis' | 'confort' | 'ultra', etc.
  label: string; // "Précis", "Confort", ...
  maxDeviationKm: number; // ex : 5, 10, 15 (±X km)
};

export type FlexOptionMetrics = {
  id: string;
  label: string;
  durationMinutes: number;
  extraMinutes: number;
  parcelCount: number;
  parcelTotal: number;
  parcelAmount: number;
  corridorPolygon?: Feature<Polygon>;
};

type UseFlexOptionsResult = {
  loading: boolean;
  error: string | null;
  options: FlexOptionMetrics[];
  refetch: () => void;
};

// -------- Mapbox helpers --------

async function fetchRouteWithGeometry(coords: LonLat[]): Promise<{ durationSec: number; geometry: LonLat[] }> {
  const coordsStr = coords.map((c) => c.join(",")).join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}` +
    `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Mapbox error: ${res.status}`);
  }

  const json = await res.json();
  const route = json.routes?.[0];
  if (!route) {
    throw new Error("No route returned by Mapbox");
  }

  const geometry: LonLat[] = route.geometry?.coordinates ?? [];
  return {
    durationSec: route.duration,
    geometry,
  };
}

async function fetchRouteDurationSeconds(coords: LonLat[]): Promise<number> {
  const coordsStr = coords.map((c) => c.join(",")).join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}` +
    `?geometries=geojson&overview=false&access_token=${MAPBOX_TOKEN}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Mapbox error: ${res.status}`);
  }
  const json = await res.json();
  const route = json.routes?.[0];
  if (!route) {
    throw new Error("No route returned by Mapbox");
  }
  return route.duration;
}

// -------- Hook principal (avec Turf) --------

export function useFlexCorridorOptions(
  origin: LonLat,
  destination: LonLat,
  parcels: Parcel[],
  corridors: FlexCorridorConfig[],
): UseFlexOptionsResult {
  const [options, setOptions] = useState<FlexOptionMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  const refetch = () => setReloadFlag((f) => f + 1);

  const memoInputs = useMemo(
    () => ({
      origin,
      destination,
      parcels,
      corridors,
    }),
    [JSON.stringify(origin), JSON.stringify(destination), parcels, corridors],
  );

  useEffect(() => {
    let cancelled = false;

    async function compute() {
      setLoading(true);
      setError(null);

      try {
        // 1. Trajet direct avec géométrie détaillée
        const baseRoute = await fetchRouteWithGeometry([memoInputs.origin, memoInputs.destination]);

        const baseDurationSec = baseRoute.durationSec;
        const baseRouteCoords = baseRoute.geometry;
        if (!baseRouteCoords.length) throw new Error("No base route geometry");

        // LineString Turf à partir de la route
        const routeLine = lineString(baseRouteCoords);
        const corridorPolygons: Record<string, Feature<Polygon> | undefined> = {};

        // 2. Créer les corridors (buffer autour de la route) pour chaque config
        for (const corridor of memoInputs.corridors) {
          const poly = buffer(routeLine, corridor.maxDeviationKm, {
            units: "kilometers",
          }) as Feature<Polygon>;
          corridorPolygons[corridor.id] = poly;
        }

        const results: FlexOptionMetrics[] = [];

        // 3. Pour chaque couloir, filtrer les colis + recalculer la durée
        for (const corridor of memoInputs.corridors) {
          const polygon = corridorPolygons[corridor.id];
          if (!polygon) continue;

          const allowedParcels = memoInputs.parcels.filter((parcel) => {
            const pickupPoint = point(parcel.pickup);
            const dropoffPoint = point(parcel.dropoff);

            const inPickup = booleanPointInPolygon(
              pickupPoint,
              polygon as Feature<Polygon | FeatureCollection | Polygon>,
            );
            const inDropoff = booleanPointInPolygon(
              dropoffPoint,
              polygon as Feature<Polygon | FeatureCollection | Polygon>,
            );

            return inPickup && inDropoff;
          });

          if (!allowedParcels.length) {
            results.push({
              id: corridor.id,
              label: corridor.label,
              durationMinutes: Math.round(baseDurationSec / 60),
              extraMinutes: 0,
              parcelCount: 0,
              parcelTotal: 0,
              parcelAmount: 0,
              corridorPolygon: polygon,
            });
            continue;
          }

          // V1 : origin → pickups → dropoffs → destination
          const waypoints: LonLat[] = [
            memoInputs.origin,
            ...allowedParcels.map((p) => p.pickup),
            ...allowedParcels.map((p) => p.dropoff),
            memoInputs.destination,
          ];

          const optionDurationSec = await fetchRouteDurationSeconds(waypoints);

          const durationMinutes = Math.round(optionDurationSec / 60);
          const extraMinutes = Math.max(0, Math.round((optionDurationSec - baseDurationSec) / 60));

          const parcelAmount = allowedParcels.reduce((sum, p) => sum + p.amount, 0);

          results.push({
            id: corridor.id,
            label: corridor.label,
            durationMinutes,
            extraMinutes,
            parcelCount: allowedParcels.length,
            parcelTotal: allowedParcels.length,
            parcelAmount,
            corridorPolygon: polygon,
          });
        }

        if (!cancelled) {
          setOptions(results);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    compute();

    return () => {
      cancelled = true;
    };
  }, [memoInputs, reloadFlag]);

  return {
    loading,
    error,
    options,
    refetch,
  };
}
