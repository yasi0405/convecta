import { useEffect, useState } from "react";
import { COMMISSION_BASE_EUR, COMMISSION_EUR_PER_KM, MAPBOX_TOKEN } from "../types";

async function mbForwardGeocodeOne(q: string) {
  if (!q?.trim()) return null;
  const url =
    "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
    encodeURIComponent(q.trim()) +
    `.json?autocomplete=true&language=fr&types=address,poi,place,locality,neighborhood&limit=1&access_token=${MAPBOX_TOKEN}`;
  const r = await fetch(url);
  const j = await r.json();
  const f = j?.features?.[0];
  return f ? { lat: f.center?.[1], lng: f.center?.[0] } : null;
}

async function mbRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?alternatives=false&geometries=geojson&overview=false&steps=false&language=fr&access_token=${MAPBOX_TOKEN}`;
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) throw new Error(j?.message || `${r.status} ${r.statusText}`);
  const route = j?.routes?.[0];
  if (!route) throw new Error("Aucun itinéraire trouvé.");
  return { durationSec: Math.round(route.duration), distanceM: Math.round(route.distance) };
}

export function useEstimate(fromAddress: string, toAddress: string) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [durationSec, setDuration] = useState<number | null>(null);
  const [distanceM, setDistance] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      setDuration(null);
      setDistance(null);
      if (!fromAddress?.trim() || !toAddress?.trim()) return;
      try {
        setLoading(true);
        const [cFrom, cTo] = await Promise.all([mbForwardGeocodeOne(fromAddress), mbForwardGeocodeOne(toAddress)]);
        if (!cFrom || !cTo) throw new Error("Adresses introuvables");
        const { durationSec, distanceM } = await mbRoute(cFrom, cTo);
        if (cancelled) return;
        setDuration(durationSec);
        setDistance(distanceM);
      } catch (e: any) {
        setErr(e?.message ?? "Échec du calcul d'itinéraire.");
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fromAddress, toAddress]);

  const commissionEUR =
    distanceM != null ? COMMISSION_BASE_EUR + (distanceM / 1000) * COMMISSION_EUR_PER_KM : null;

  return { loading, err, durationSec, distanceM, commissionEUR };
}