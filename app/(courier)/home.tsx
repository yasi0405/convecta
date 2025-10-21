import Colors from "@/constants/Colors";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Schema } from "../../amplify/data/resource";

// ⚙️ Token Mapbox depuis l'env
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN as string;

// ⚙️ Paramètres commission
const COMMISSION_BASE_EUR = 1;     // 1€ dès le départ
const COMMISSION_EUR_PER_KM = 0.5; // €/km

export default function CourierHome() {
  const client = generateClient<Schema>();
  const router = useRouter();

  // 🔢 Statuts étendus (alignés avec le schéma backend)
  type ParcelStatus =
    | "AVAILABLE"
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "DELIVERING"
    | "DELIVERED"
    | "CANCELLED";

  type Parcel = {
    id: string;
    type: string;
    status: ParcelStatus;
    poids?: number | string | null;
    dimensions?: string | null;
    description?: string | null;

    // ✅ nouveau schéma
    adresseDepart?: string | null;
    adresseArrivee?: string | null;

    // (legacy)
    adresse?: string | null;

    assignedTo?: string | null;
    owner?: string | null;

    createdAt?: string | null; // ISO 8601
    updatedAt?: string | null;
  };

  type Coords = { lat: number; lng: number };

  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [selected, setSelected] = useState<Parcel | null>(null);
  const [accepting, setAccepting] = useState<boolean>(false);

  // 📍 Position livreur
  const [myPos, setMyPos] = useState<Coords | null>(null);

  // ⏱ ETA total (A→B + B→C) par colis.id en secondes
  const [etaByParcel, setEtaByParcel] = useState<Record<string, number | null>>({});
  // 📏 Distance totale (A→B + B→C) par colis.id en mètres
  const [distByParcel, setDistByParcel] = useState<Record<string, number | null>>({});

  // 👤 ID utilisateur connecté (robuste aux versions Amplify)
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        const uid =
          (user as any)?.userId ??
          (user as any)?.username ??
          (user as any)?.signInDetails?.loginId ??
          (user as any)?.attributes?.sub ??
          null;
        setUserId(uid);
      } catch (err) {
        console.log("Erreur getCurrentUser →", err);
      }
    })();
  }, []);

  // --- Helpers Mapbox (geocode & directions) ---
  const mbForwardGeocode = async (addr: string): Promise<Coords | null> => {
    if (!MAPBOX_TOKEN) throw new Error("Clé Mapbox manquante (EXPO_PUBLIC_MAPBOX_TOKEN).");
    const url =
      "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
      encodeURIComponent(addr.trim()) +
      `.json?limit=1&language=fr&access_token=${MAPBOX_TOKEN}`;
    const r = await fetch(url);
    let j: any = null;
    try {
      j = await r.json();
    } catch {}
    if (!r.ok) {
      const msg = j?.message || `${r.status} ${r.statusText}`;
      throw new Error(`Geocoding échoué: ${msg}`);
    }
    const f = j?.features?.[0];
    if (!f) return null;
    const [lng, lat] = f.center || [];
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    return { lat, lng };
  };

  // ↩︎ renvoie durée (sec) ET distance (m)
  const mbRoute = async (from: Coords, to: Coords): Promise<{ durationSec: number; distanceM: number }> => {
    if (!MAPBOX_TOKEN) throw new Error("Clé Mapbox manquante (EXPO_PUBLIC_MAPBOX_TOKEN).");
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?alternatives=false&geometries=geojson&overview=false&steps=false&language=fr&access_token=${MAPBOX_TOKEN}`;
    const r = await fetch(url);
    let j: any = null;
    try {
      j = await r.json();
    } catch {}
    if (!r.ok) {
      const msg = j?.message || `${r.status} ${r.statusText}`;
      throw new Error(`Directions échouées: ${msg}`);
    }
    const route = j?.routes?.[0];
    if (!route) throw new Error("Aucun itinéraire trouvé.");
    const durationSec = Math.max(0, Math.round(route.duration as number));
    const distanceM = Math.max(0, Math.round(route.distance as number));
    return { durationSec, distanceM };
  };

  // 🔁 charge la liste des colis disponibles
  const listAvailable = async () => {
    try {
      const res = await client.models.Parcel.list({
        filter: { status: { eq: "AVAILABLE" } },
        limit: 100,
        authMode: "userPool", // ✅ dans le même objet
      });

      // Compat Gen2/Gen1
      const items: Parcel[] =
        (Array.isArray((res as any)?.data) && (res as any).data.length > 0
          ? (res as any).data
          : Array.isArray((res as any)?.items)
          ? (res as any).items
          : []) as Parcel[];

      return items;
    } catch (e: any) {
      console.log("listAvailable error →", e?.message || e);
      return [];
    }
  };

  const loadParcels = async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await listAvailable();
      setParcels(rows);
    } catch (e: any) {
      console.log("list Parcel error →", e);
      setError(e?.message ?? "Erreur lors du chargement des colis");
      setParcels([]);
    } finally {
      setLoading(false);
    }
  };

  // Chargement initial
  useEffect(() => {
    loadParcels();
  }, []);

  // 📍 Récupérer permission + position du livreur (foreground)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          // Pas bloquant pour l'écran, juste pas d'ETA/commission.
          return;
        }
        const last = await Location.getLastKnownPositionAsync();
        if (last && mounted) {
          setMyPos({ lat: last.coords.latitude, lng: last.coords.longitude });
        } else {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (!mounted) return;
          setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch (e: any) {
        // silencieux, l'ETA/commission resteront vides
        console.log("GPS error", e?.message);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Tri anti-ancien (plus récent en haut)
  const sortedParcels = useMemo(() => {
    return [...parcels].sort((a, b) => {
      const da = a.createdAt ? Date.parse(a.createdAt) : 0;
      const db = b.createdAt ? Date.parse(b.createdAt) : 0;
      return db - da;
    });
  }, [parcels]);

  // ⏱ / 📏 Calcul A→B→C pour chaque item (séquentiel pour éviter de spammer l'API)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!myPos || parcels.length === 0) return;
      for (const p of parcels) {
        if (cancelled) break;
        // si déjà calculé, skip
        const hasEta = etaByParcel[p.id] != null;
        const hasDist = distByParcel[p.id] != null;
        if (hasEta && hasDist) continue;

        const pickupAddr = p.adresseDepart ?? p.adresse ?? "";
        const dropAddr = p.adresseArrivee ?? "";

        if (!pickupAddr || !dropAddr) {
          // on enregistre null pour afficher "—"
          setEtaByParcel((prev) => ({ ...prev, [p.id]: null }));
          setDistByParcel((prev) => ({ ...prev, [p.id]: null }));
          continue;
        }

        try {
          const [pickup, drop] = await Promise.all([mbForwardGeocode(pickupAddr), mbForwardGeocode(dropAddr)]);
          if (!pickup || !drop) {
            setEtaByParcel((prev) => ({ ...prev, [p.id]: null }));
            setDistByParcel((prev) => ({ ...prev, [p.id]: null }));
            continue;
          }
          const r1 = await mbRoute(myPos, pickup); // A→B
          const r2 = await mbRoute(pickup, drop);  // B→C
          const totalSec = r1.durationSec + r2.durationSec;
          const totalM = r1.distanceM + r2.distanceM;

          if (cancelled) break;
          setEtaByParcel((prev) => ({ ...prev, [p.id]: totalSec }));
          setDistByParcel((prev) => ({ ...prev, [p.id]: totalM }));
        } catch (e: any) {
          console.log("ETA/Dist error", e?.message || e);
          setEtaByParcel((prev) => ({ ...prev, [p.id]: null }));
          setDistByParcel((prev) => ({ ...prev, [p.id]: null }));
        }
        // petite respiration entre items pour éviter les quotas trop stricts
        await new Promise((r) => setTimeout(r, 200));
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPos, parcels]);

  const onSelect = (p: Parcel) => setSelected(p);

  // ✅ Acceptation: on passe directement en IN_PROGRESS et on assigne le livreur
  // ✅ Acceptation: passe en IN_PROGRESS + assigne le livreur
  const onAccept = async () => {
    if (!selected) return;
    if (!userId) {
      setError("Utilisateur non authentifié. Réessaie après connexion.");
      return;
    }

    try {
      setAccepting(true);
      const now = new Date().toISOString();

      // Statut approprié à l'acceptation :
      // - AVAILABLE/ASSIGNED -> IN_PROGRESS (pour que le client voie "en cours")
      const nextStatus: ParcelStatus =
        selected.status === "AVAILABLE" || selected.status === "ASSIGNED"
          ? "IN_PROGRESS"
          : (selected.status ?? "IN_PROGRESS");

      await client.models.Parcel.update(
        {
          id: selected.id,
          status: nextStatus,
          assignedTo: userId,
          updatedAt: now,
        },
        { authMode: "userPool" }
      );

      // Retirer de la liste des "AVAILABLE"
      setParcels((prev) => prev.filter((x) => x.id !== selected.id));

      // Redirige vers la navigation (adresse d'enlèvement)
      const pickup = selected.adresseDepart ?? selected.adresse ?? "";
      router.push({
        pathname: "/(courier)/navigate",
        params: { id: selected.id, dest: pickup, label: selected.type ?? "Mission" },
      });

      setSelected(null);
    } catch (e: any) {
      console.log("accept Parcel error →", e);
      setError(e?.message ?? "Erreur lors de l’acceptation de la mission");
    } finally {
      setAccepting(false);
    }
  };

  const onCancel = () => setSelected(null);

  const fmt = (v?: string | number | null) => (v == null || v === "" ? "—" : String(v));
  const fmtKg = (v?: number | string | null) => {
    if (v == null || v === "") return "—";
    const n = typeof v === "string" ? Number(String(v).replace(",", ".")) : v;
    return Number.isFinite(n as number) ? `${n} kg` : String(v);
  };
  const fmtETA = (sec?: number | null) => {
    if (sec == null || !Number.isFinite(sec)) return "—";
    const m = Math.round(sec / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h} h ${rm} min`;
  };
  const fmtEUR = (n?: number | null) => {
    if (n == null || !Number.isFinite(n)) return "—";
    return `${n.toFixed(2)} €`;
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 80 }]}>
      <Text style={styles.title}>Colis disponibles</Text>

      {loading && (
        <View style={styles.centerRow}>
          <ActivityIndicator />
          <Text style={styles.muted}> Chargement…</Text>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      {!loading && !error && (
        <FlatList
          data={sortedParcels}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const pickup = item.adresseDepart ?? item.adresse ?? null; // compat legacy
            const drop = item.adresseArrivee ?? null;

            const etaSec = etaByParcel[item.id];
            const distM = distByParcel[item.id];
            const km = distM != null ? distM / 1000 : null;
            const commission = km != null ? COMMISSION_BASE_EUR + COMMISSION_EUR_PER_KM * km : null;

            return (
              <Pressable style={styles.card} onPress={() => onSelect(item)}>
                <Text style={styles.cardTitle}>{item.type || "Colis"}</Text>
                {item.description ? <Text style={styles.cardText}>{item.description}</Text> : null}
                {item.poids != null && item.poids !== "" ? (
                  <Text style={styles.cardText}>Poids: {fmtKg(item.poids)}</Text>
                ) : null}
                {item.dimensions ? <Text style={styles.cardText}>Dim: {item.dimensions}</Text> : null}

                {/* ✅ nouvelles adresses */}
                {pickup ? <Text style={styles.cardText}>Enlèvement: {pickup}</Text> : null}
                {drop ? <Text style={styles.cardText}>Livraison: {drop}</Text> : null}

                {item.createdAt ? (
                  <Text style={[styles.cardText, { opacity: 0.6 }]}>
                    Créé le {new Date(item.createdAt).toLocaleString()}
                  </Text>
                ) : null}

                {/* ⬇️ Bas divisé en deux : Temps & Commission */}
                <View style={styles.bottomRow}>
                  <View style={styles.bottomCol}>
                    <Text style={styles.bottomLabel}>Temps pour la course</Text>
                    <Text style={styles.bottomBig}>{etaSec === undefined ? "…" : fmtETA(etaSec)}</Text>
                    {etaSec === null && <Text style={styles.bottomHint}>Indisponible (adress./GPS/Mapbox)</Text>}
                  </View>

                  <View style={[styles.bottomCol, styles.bottomColRight]}>
                    <Text style={styles.bottomLabel}>Commission estimée</Text>
                    <Text style={styles.bottomBig}>{commission == null ? "—" : fmtEUR(commission)}</Text>
                    <Text style={styles.bottomHint}>1€ + {COMMISSION_EUR_PER_KM}€/km</Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.muted}>Aucun colis dispo pour le moment.</Text>}
        />
      )}

      <TouchableOpacity style={styles.button} onPress={loadParcels}>
        <Text style={styles.buttonText}>Rafraîchir la liste</Text>
      </TouchableOpacity>

      {/* Bouton debug */}
      {__DEV__ && (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: "#444" }]}
          onPress={async () => {
            try {
              setLoading(true);
              setError(null);
              const now = new Date().toISOString();
              await client.models.Parcel.create(
                {
                  type: "BPOST_SMALL_BOX",
                  status: "AVAILABLE",
                  poids: 1.2,
                  dimensions: "30x20x15 cm",
                  description: "Colis de test (debug)",
                  // ✅ nouveau schéma : 2 adresses
                  adresseDepart: "Place de la Gare 1, 1060 Saint-Gilles",
                  adresseArrivee: "Rue du Marché 12, 1000 Bruxelles",
                  createdAt: now,
                  updatedAt: now,
                } as any,
                { authMode: "userPool" }
              );
              await loadParcels();
            } catch (e: any) {
              console.log("create Parcel (debug) error →", e);
              setError(e?.message ?? "Erreur lors de la création du colis de test");
            } finally {
              setLoading(false);
            }
          }}
        >
          <Text style={styles.buttonText}>[DEV] Créer un colis de test</Text>
        </TouchableOpacity>
      )}

      {/* Dialog Accepter mission */}
      <Modal transparent visible={!!selected} animationType="fade" onRequestClose={onCancel}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Accepter la mission ?</Text>
            {selected ? (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.modalText}>
                  {selected.type || "Colis"}
                  {selected.poids ? ` · ${fmtKg(selected.poids)}` : ""}
                </Text>
                {/* ✅ détails adresses */}
                {selected.adresseDepart ? (
                  <Text style={[styles.modalText, { opacity: 0.9 }]}>Enlèvement: {selected.adresseDepart}</Text>
                ) : selected.adresse ? (
                  <Text style={[styles.modalText, { opacity: 0.9 }]}>Enlèvement: {selected.adresse /* legacy */}</Text>
                ) : null}
                {selected.adresseArrivee ? (
                  <Text style={[styles.modalText, { opacity: 0.9 }]}>Livraison: {selected.adresseArrivee}</Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.modalRow}>
              <TouchableOpacity onPress={onCancel} disabled={accepting} style={[styles.modalBtn, styles.modalBtnNo]}>
                <Text style={styles.modalBtnText}>NO</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onAccept}
                disabled={accepting}
                style={[styles.modalBtn, styles.modalBtnYes, accepting && { opacity: 0.7 }]}
              >
                {accepting ? <ActivityIndicator /> : <Text style={[styles.modalBtnText, { color: "#fff" }]}>YES</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: Colors.background, flexGrow: 1 },
  title: { fontSize: 22, marginBottom: 20, textAlign: "center", color: Colors.text },
  centerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, justifyContent: "center" },
  muted: { color: Colors.textSecondary, textAlign: "center" },
  error: { color: "#B00020", marginBottom: 12, textAlign: "center" },

  card: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: Colors.card,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4, color: Colors.textOnCard },
  cardText: { fontSize: 14, color: Colors.textOnCard },

  // ⬇️ Bas en 2 colonnes : Temps & Commission
  bottomRow: {
    marginTop: 12,
    paddingTop: 10,
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

  button: {
    backgroundColor: Colors.button,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  buttonText: { color: Colors.buttonText, fontSize: 16, fontWeight: "bold" },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 24,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8, color: Colors.textOnCard },
  modalText: { fontSize: 14, color: Colors.textOnCard, marginBottom: 4 },
  modalRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  modalBtnNo: { borderColor: Colors.border, backgroundColor: Colors.background },
  modalBtnYes: { borderColor: Colors.button, backgroundColor: Colors.button },
  modalBtnText: { fontSize: 16, fontWeight: "700", color: Colors.text },
});