import { useEffect, useRef, useState } from "react";
import type { Suggestion } from "../types";
import { MAPBOX_TOKEN } from "../types";

async function mbForwardGeocode(q: string, signal?: AbortSignal): Promise<Suggestion[]> {
  if (!q?.trim()) return [];
  const url =
    "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
    encodeURIComponent(q.trim()) +
    `.json?autocomplete=true&language=fr&types=address,place,poi,locality,neighborhood&limit=5&access_token=${MAPBOX_TOKEN}`;
  const r = await fetch(url, { signal });
  const j = await r.json();
  return (j?.features ?? []).map((f: any) => ({
    id: f.id as string,
    label: f.place_name as string,
    coords: f.center ? { lng: f.center[0], lat: f.center[1] } : undefined,
  }));
}

export function useAddressAutocomplete(value: string) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // reset quand la valeur change
    setError(null);
    if (!value?.trim()) {
      setSuggestions([]);
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await mbForwardGeocode(value, ctrl.signal);
        if (!ctrl.signal.aborted) setSuggestions(res);
      } catch (e: any) {
        if (!ctrl.signal.aborted) setError(e?.message ?? "Échec de l'autocomplétion.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  return { suggestions, setSuggestions, loading, error };
}