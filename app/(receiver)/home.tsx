import Colors from "@/constants/Colors";
import { getCurrentUser } from "aws-amplify/auth"; // ✅ check auth
import { generateClient } from "aws-amplify/data";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { Schema } from "../../amplify/data/resource";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN as string; // ✅ via env

// ⚙️ Paramètres tarifaires (ajuste facilement)
const COMMISSION_BASE_EUR = 1;      // 1€ dès le départ
const COMMISSION_EUR_PER_KM = 0.4;  // 0.4€ par km (par défaut)

// Petits helpers Mapbox
async function mbForwardGeocode(q: string) {
  if (!q?.trim()) return [];
  const url =
    "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
    encodeURIComponent(q.trim()) +
    `.json?autocomplete=true&language=fr&types=address,poi,place,locality,neighborhood&limit=5&access_token=${MAPBOX_TOKEN}`;
  const r = await fetch(url);
  const j = await r.json();
  return (j?.features ?? []).map((f: any) => ({
    id: f.id,
    label: f.place_name,
    coords: { lng: f.center?.[0], lat: f.center?.[1] },
  }));
}

async function mbForwardGeocodeOne(q: string) {
  const res = await mbForwardGeocode(q);
  return res?.[0]?.coords
    ? { lat: res[0].coords.lat, lng: res[0].coords.lng }
    : null;
}

async function mbReverseGeocode(lat: number, lng: number) {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
    `?language=fr&types=address,poi,place,locality,neighborhood&limit=1&access_token=${MAPBOX_TOKEN}`;
  const r = await fetch(url);
  const j = await r.json();
  const f = j?.features?.[0];
  if (!f) return null;
  return {
    id: f.id,
    label: f.place_name as string,
    coords: { lng: f.center?.[0], lat: f.center?.[1] },
  };
}

// ↩︎ durée (sec) ET distance (m) entre 2 coords
async function mbRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?alternatives=false&geometries=geojson&overview=false&steps=false&language=fr&access_token=${MAPBOX_TOKEN}`;
  const r = await fetch(url);
  let j: any = null;
  try { j = await r.json(); } catch {}
  if (!r.ok) {
    const msg = j?.message || `${r.status} ${r.statusText}`;
    throw new Error(`Directions échouées: ${msg}`);
  }
  const route = j?.routes?.[0];
  if (!route) throw new Error("Aucun itinéraire trouvé.");
  const durationSec = Math.max(0, Math.round(route.duration as number));
  const distanceM = Math.max(0, Math.round(route.distance as number));
  return { durationSec, distanceM };
}

const BPOST_PRESETS = [
  {
    id: "standard",
    label: "Bpost — Colis standard (<=30 kg)",
    help: "Longueur <= 1,5 m et L+2W+2H <= 3 m.",
    max: { kg: 30, longestCm: 150, sumCm: 300 },
  },
  {
    id: "locker",
    label: "Bpost — Locker bbox (<=30 kg)",
    help: "Casier: max 420 × 310 × 580 mm.",
    max: { kg: 30, box: [42, 31, 58] },
  },
  {
    id: "packfree",
    label: "Bpost — Pack & Label Free (<=10 kg)",
    help: "Casier: max 480 × 320 × 200 mm.",
    max: { kg: 10, box: [48, 32, 20] },
  },
] as const;

// ✅ Alerte cross-platform (Alert est capricieux sur web)
const notify = (title: string, msg: string) =>
  Platform.OS === "web" ? window.alert(`${title}\n\n${msg}`) : Alert.alert(title, msg);

type Suggestion = { id: string; label: string; coords?: { lat: number; lng: number } };

export default function NewParcel() {
  const router = useRouter();
  const client = generateClient<Schema>();
  const { prefill } = useLocalSearchParams<{ prefill?: string | string[] }>();

  // --- Mode création / édition
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [prefillConsumed, setPrefillConsumed] = useState(false); // ✅ on n’applique le prefill qu’une fois

  // --- Form state
  const [type, setType] = useState("");
  const [poids, setPoids] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [description, setDescription] = useState("");
  const [preset, setPreset] = useState<typeof BPOST_PRESETS[number]["id"] | null>(null);

  // 🆕 dropdown pour le type bpost
  const [showTypeList, setShowTypeList] = useState(false);

  // 🆕 Départ / Arrivée (autocomplete)
  const [adresseDepart, setAdresseDepart] = useState("");
  const [adresseArrivee, setAdresseArrivee] = useState("");

  const [depSuggestions, setDepSuggestions] = useState<Suggestion[]>([]);
  const [arrSuggestions, setArrSuggestions] = useState<Suggestion[]>([]);

  const depTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 🧮 Estimation Receiver (Départ → Arrivée)
  const [estLoading, setEstLoading] = useState(false);
  const [estError, setEstError] = useState<string | null>(null);
  const [estDurationSec, setEstDurationSec] = useState<number | null>(null);
  const [estDistanceM, setEstDistanceM] = useState<number | null>(null);

  // --- Hydratation depuis `prefill`
  const prefillData = useMemo(() => {
    if (!prefill) return null;
    const raw = Array.isArray(prefill) ? prefill[0] : prefill;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [prefill]);

  // ✅ Appliquer le prefill une seule fois
  useEffect(() => {
    if (!prefillData || prefillConsumed) return;
    if (typeof prefillData.id === "string" && prefillData.id.trim()) {
      setIsEdit(true);
      setEditId(prefillData.id);
    }
    if (typeof prefillData.type === "string") setType(prefillData.type);
    if (typeof prefillData.description === "string") setDescription(prefillData.description);
    if (prefillData.poids != null) setPoids(String(prefillData.poids));
    if (typeof prefillData.dimensions === "string") setDimensions(prefillData.dimensions);
    if (typeof prefillData.adresseDepart === "string") setAdresseDepart(prefillData.adresseDepart);
    if (typeof prefillData.adresseArrivee === "string") setAdresseArrivee(prefillData.adresseArrivee);
    setPrefillConsumed(true);
  }, [prefillData, prefillConsumed]);

  // 🔎 debounce pour départ
  useEffect(() => {
    if (depTimer.current) clearTimeout(depTimer.current);
    depTimer.current = setTimeout(async () => {
      if (!adresseDepart) {
        setDepSuggestions([]);
        return;
      }
      try {
        const res = await mbForwardGeocode(adresseDepart);
        setDepSuggestions(res);
      } catch {
        setDepSuggestions([]);
      }
    }, 300);
    return () => {
      if (depTimer.current) clearTimeout(depTimer.current);
    };
  }, [adresseDepart]);

  // 🔎 debounce pour arrivée
  useEffect(() => {
    if (arrTimer.current) clearTimeout(arrTimer.current);
    arrTimer.current = setTimeout(async () => {
      if (!adresseArrivee) {
        setArrSuggestions([]);
        return;
      }
      try {
        const res = await mbForwardGeocode(adresseArrivee);
        setArrSuggestions(res);
      } catch {
        setArrSuggestions([]);
      }
    }, 300);
    return () => {
      if (arrTimer.current) clearTimeout(arrTimer.current);
    };
  }, [adresseArrivee]);

  // 🧮 Calcule l'estimation (temps + distance) quand les 2 adresses sont remplies
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setEstError(null);
      setEstDurationSec(null);
      setEstDistanceM(null);

      const from = adresseDepart?.trim();
      const to = adresseArrivee?.trim();
      if (!from || !to) return;

      if (!MAPBOX_TOKEN) {
        setEstError("Clé Mapbox absente (EXPO_PUBLIC_MAPBOX_TOKEN).");
        return;
      }

      try {
        setEstLoading(true);
        const [cFrom, cTo] = await Promise.all([
          mbForwardGeocodeOne(from),
          mbForwardGeocodeOne(to),
        ]);
        if (!cFrom || !cTo) {
          setEstError("Adresses introuvables (vérifie les champs).");
          return;
        }
        const { durationSec, distanceM } = await mbRoute(cFrom, cTo);
        if (cancelled) return;
        setEstDurationSec(durationSec);
        setEstDistanceM(distanceM);
      } catch (e: any) {
        setEstError(e?.message ?? "Échec du calcul d'itinéraire.");
      } finally {
        setEstLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [adresseDepart, adresseArrivee]);

  const askAndUseGPSForDeparture = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        notify("Localisation refusée", "Active la localisation pour utiliser ta position comme adresse de départ.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const rev = await mbReverseGeocode(pos.coords.latitude, pos.coords.longitude);
      if (rev?.label) {
        setAdresseDepart(rev.label);
        setDepSuggestions([]);
      } else {
        notify("Oups", "Adresse introuvable à partir de ta position.");
      }
    } catch (e: any) {
      notify("Erreur GPS", e?.message ?? "Impossible d'obtenir ta position.");
    }
  };

  // ✅ réinitialise le formulaire et sort du mode édition
  const resetForm = () => {
    setIsEdit(false);
    setEditId(null);
    setPrefillConsumed(true); // bloque toute ré-application accidentelle tant que la page est montée
    setType("");
    setPoids("");
    setDimensions("");
    setDescription("");
    setAdresseDepart("");
    setAdresseArrivee("");
    setPreset(null);
    setShowTypeList(false);
  };

  // ✅ bouton "Nouveau colis" — enlève le param `prefill` de l'URL
  const handleNewParcel = () => {
    resetForm();
    // remplace la route courante sans le paramètre `prefill`
    // (adapter le chemin si ton group path diffère)
    router.replace("/home");
  };

  const handleSubmit = async () => {
    // ✅ Garde-fous UI
    if (!type) {
      setError("Sélectionne d'abord un type (liste déroulante).");
      return;
    }
    if (!adresseDepart?.trim()) {
      setError("Ajoute une adresse de départ (autocomplete ou GPS).");
      return;
    }
    if (!adresseArrivee?.trim()) {
      setError("Ajoute une adresse d’arrivée (autocomplete).");
      return;
    }

    // normalise poids : "1,5" -> "1.5"
    const poidsNormalized = poids?.trim().replace(",", ".");
    const poidsNum = poidsNormalized ? parseFloat(poidsNormalized) : undefined;

    try {
      setLoading(true);
      setError(null);

      // ✅ Vérifie si utilisateur connecté
      const user = await getCurrentUser().catch(() => null);
      if (!user) {
        notify("Non connecté", "Tu dois être connecté pour continuer.");
        return;
      }
      const ownerId =
        (user as any)?.username ||
        (user as any)?.userId ||
        "unknown";

      const now = new Date().toISOString();

      if (isEdit && editId) {
        // 🔁 UPDATE
        const res = await client.models.Parcel.update(
          {
            id: editId,
            type: (type ?? "").trim(),
            poids: Number.isFinite(poidsNum as number) ? (poidsNum as number) : undefined,
            dimensions: (dimensions ?? "").trim(),
            description: (description ?? "").trim(),
            adresseDepart: (adresseDepart ?? "").trim(),
            adresseArrivee: (adresseArrivee ?? "").trim(),
            // On ne touche pas au statut si non requis
            updatedAt: now,
          } as any,
          { authMode: "userPool" }
        );

        const updatedId = (res as any)?.data?.id ?? editId;

        // Navigation post-update (résumé)
        router.replace({
          pathname: "/(receiver)/summary",
          params: { id: updatedId, updated: "1" },
        });
        return;
      }

      // ➕ CREATE (comportement existant)
      const createRes = await client.models.Parcel.create(
        {
          type: (type ?? "").trim(),
          poids: Number.isFinite(poidsNum as number) ? (poidsNum as number) : undefined,
          dimensions: (dimensions ?? "").trim(),
          description: (description ?? "").trim(),
          adresseDepart: (adresseDepart ?? "").trim(),
          adresseArrivee: (adresseArrivee ?? "").trim(),
          status: "AVAILABLE",
          owner: ownerId,
          receiverId: ownerId,
          createdAt: now,
          updatedAt: now,
        } as any,
        { authMode: "userPool" }
      );

      const createdId = (createRes as any)?.data?.id ?? "";

      // reset formulaire (création seulement)
      resetForm();

      // navigation vers le résumé
      router.replace({
        pathname: "/(receiver)/summary",
        params: { id: createdId },
      });
    } catch (e: any) {
      console.log(isEdit ? "update Parcel error →" : "create Parcel error →", e);
      setError(e?.message ?? (isEdit ? "Erreur lors de la mise à jour du colis" : "Erreur lors de la création du colis"));
    } finally {
      setLoading(false);
    }
  };

  // format helpers
  const fmtETA = (sec?: number | null) => {
    if (sec == null || !Number.isFinite(sec)) return "—";
    const m = Math.round(sec / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h} h ${rm} min`;
  };
  const fmtKm = (m?: number | null) => {
    if (m == null || !Number.isFinite(m)) return "—";
    if (m < 1000) return `${Math.round(m)} m`;
    const km = m / 1000;
    return `${km.toFixed(km >= 10 ? 0 : 1)} km`;
  };
  const fmtEUR = (n?: number | null) => {
    if (n == null || !Number.isFinite(n)) return "—";
    return `${n.toFixed(2)} €`;
  };

  // Commission calculée sur la distance Départ→Arrivée
  const commissionEUR =
    estDistanceM != null
      ? COMMISSION_BASE_EUR + (estDistanceM / 1000) * COMMISSION_EUR_PER_KM
      : null;

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 80 }]} keyboardShouldPersistTaps="handled">
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.headerRow}>
        <Text style={styles.title}>{isEdit ? "Modifier le colis" : "Nouveau colis"}</Text>
        <TouchableOpacity style={styles.newButton} onPress={handleNewParcel}>
          <Text style={styles.newButtonText}>🆕 Nouveau colis</Text>
        </TouchableOpacity>
      </View>

      {/* Champ Type (liste déroulante intégrée) */}
      <Text style={styles.label}>Type bpost</Text>
      <Pressable
        onPress={() => setShowTypeList((v) => !v)}
        style={[styles.input, styles.typeInput]}
        accessibilityRole="button"
        accessibilityLabel="Choisir un type bpost"
      >
        <Text style={[styles.typeText, !type && { color: Colors.textSecondary }]}>
          {type || "Choisir un type bpost…"}
        </Text>
        <Text style={styles.caret}>{showTypeList ? "▲" : "▼"}</Text>
      </Pressable>

      {showTypeList && (
        <View style={styles.dropdownBox}>
          {BPOST_PRESETS.map((p) => (
            <Pressable
              key={p.id}
              style={styles.dropdownItem}
              onPress={() => {
                setPreset(p.id);
                setType(p.label);
                setShowTypeList(false);
              }}
            >
              <Text style={styles.dropdownLabel}>{p.label}</Text>
              <Text style={styles.dropdownHelp}>{p.help}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* 🆕 Adresse de départ (autocomplete + GPS) */}
      <Text style={styles.label}>Adresse de départ</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Rue, numéro, ville…"
          value={adresseDepart}
          onChangeText={setAdresseDepart}
          placeholderTextColor={Colors.textSecondary}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <TouchableOpacity
          onPress={askAndUseGPSForDeparture}
          style={styles.gpsButton}
          accessibilityRole="button"
          accessibilityLabel="Utiliser ma position actuelle"
        >
          <Text style={{ fontSize: 18 }}>📍</Text>
        </TouchableOpacity>
      </View>
      {depSuggestions.length > 0 && (
        <View style={styles.suggestBox}>
          {depSuggestions.map((s) => (
            <Pressable
              key={s.id}
              style={styles.suggestItem}
              onPress={() => {
                setAdresseDepart(s.label);
                setDepSuggestions([]);
              }}
            >
              <Text style={styles.suggestText}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* 🆕 Adresse d'arrivée (autocomplete seulement) */}
      <Text style={styles.label}>Adresse d’arrivée</Text>
      <TextInput
        style={styles.input}
        placeholder="Rue, numéro, ville…"
        value={adresseArrivee}
        onChangeText={setAdresseArrivee}
        placeholderTextColor={Colors.textSecondary}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {arrSuggestions.length > 0 && (
        <View style={styles.suggestBox}>
          {arrSuggestions.map((s) => (
            <Pressable
              key={s.id}
              style={styles.suggestItem}
              onPress={() => {
                setAdresseArrivee(s.label);
                setArrSuggestions([]);
              }}
            >
              <Text style={styles.suggestText}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Autres champs */}
      <Text style={styles.label}>Poids (kg)</Text>
      <TextInput
        style={styles.input}
        placeholder="ex: 1.2"
        value={poids}
        onChangeText={setPoids}
        keyboardType="numeric"
        placeholderTextColor={Colors.textSecondary}
      />

      <Text style={styles.label}>Dimensions (cm)</Text>
      <TextInput
        style={styles.input}
        placeholder="ex: 40×30×20"
        value={dimensions}
        onChangeText={setDimensions}
        placeholderTextColor={Colors.textSecondary}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.input}
        placeholder="Contenu, précautions, etc."
        value={description}
        onChangeText={setDescription}
        placeholderTextColor={Colors.textSecondary}
      />

      {/* 🧮 Estimation visible par le receiver */}
      <View style={styles.estimateBox}>
        <View style={styles.estimateHeader}>
          <Text style={styles.estimateTitle}>Estimation</Text>
          {estLoading ? (
            <View style={styles.estimateLoading}>
              <ActivityIndicator />
              <Text style={styles.estimateHint}> Calcul en cours…</Text>
            </View>
          ) : null}
        </View>

        {estError ? (
          <Text style={[styles.estimateError]}>{estError}</Text>
        ) : (
          <View style={styles.bottomRow}>
            <View style={styles.bottomCol}>
              <Text style={styles.bottomLabel}>Temps estimé</Text>
              <Text style={styles.bottomBig}>{fmtETA(estDurationSec)}</Text>
              <Text style={styles.bottomHint}>{fmtKm(estDistanceM)}</Text>
            </View>

            <View style={[styles.bottomCol, styles.bottomColRight]}>
              <Text style={styles.bottomLabel}>Frais estimés</Text>
              <Text style={styles.bottomBig}>{fmtEUR(commissionEUR)}</Text>
              <Text style={styles.bottomHint}>
                1€ + {COMMISSION_EUR_PER_KM}€/km
              </Text>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? (isEdit ? "Mise à jour…" : "Création…") : (isEdit ? "Mettre à jour" : "Valider")}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: Colors.background, flexGrow: 1 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },

  title: { fontSize: 22, textAlign: "left", color: Colors.text, flex: 1 },

  newButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  newButtonText: { color: Colors.textOnCard, fontWeight: "700" },

  label: { color: Colors.text, marginBottom: 6, marginTop: 10, fontWeight: "600" },

  input: {
    backgroundColor: Colors.input,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    color: Colors.text,
  },

  // Champ Type (dropdown)
  typeInput: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typeText: { fontSize: 16 },
  caret: { marginLeft: 8, fontSize: 12, opacity: 0.7 },

  dropdownBox: {
    backgroundColor: "#fff",
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 8,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomColor: "#eee",
    borderBottomWidth: 1,
  },
  dropdownLabel: { color: Colors.textOnCard, fontWeight: "600", marginBottom: 2 },
  dropdownHelp: { color: "#666", fontSize: 12 },

  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 0 },
  gpsButton: {
    marginLeft: 8,
    backgroundColor: Colors.input,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },

  error: { color: "#B00020", marginBottom: 12, textAlign: "center" },

  // Suggestions dropdown (adresses)
  suggestBox: {
    backgroundColor: "#fff",
    borderColor: "#ddd",
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 8,
    overflow: "hidden",
    zIndex: 20,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  suggestItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomColor: "#f1f5f9",
    borderBottomWidth: 1,
  },
  suggestText: { color: "#111827" },

  // 🧮 Estimation bloc
  estimateBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  estimateHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  estimateTitle: { color: Colors.textOnCard, fontWeight: "700", fontSize: 14 },
  estimateLoading: { flexDirection: "row", alignItems: "center" },
  estimateHint: { color: Colors.textOnCard, opacity: 0.7, marginLeft: 8, fontSize: 12 },
  estimateError: { color: "#ff6b6b" },

  // ⬇️ Bas en 2 colonnes : Temps & Frais
  bottomRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    flexDirection: "row",
    gap: 12,
  },
  bottomCol: { flex: 1 },
  bottomColRight: { alignItems: "flex-end" },
  bottomLabel: { color: Colors.textOnCard, opacity: 0.8, fontSize: 12, marginBottom: 2 },
  bottomBig: { color: Colors.textOnCard, fontSize: 20, fontWeight: "800" },
  bottomHint: { color: Colors.textOnCard, fontSize: 11, opacity: 0.7, marginTop: 2 },

  // CTA
  button: {
    backgroundColor: Colors.button,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
    alignItems: "center",
  },
  buttonText: { color: Colors.buttonText, fontSize: 16, fontWeight: "bold" },
});