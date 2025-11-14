import { Parcel as ParcelCtx, useParcelContext } from "@/context/ParcelContext";
import Colors from "@/theme/Colors";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// 🔄 expo-camera (remplace expo-barcode-scanner déprécié)
import { CameraView, useCameraPermissions } from "expo-camera";
// 🛟 on applique les insets nous-mêmes (plus fiable que SafeAreaView dans les modales full-screen iOS)
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ParcelStatus =
  | "AVAILABLE"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "DELIVERING"
  | "DELIVERED"
  | "CANCELLED";

type Parcel = Omit<ParcelCtx, "status"> & {
  status?: ParcelStatus;
  assignedTo?: string | null;
  courierName?: string | null;
  owner?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const client = generateClient<any>();

export default function CourierPendingList() {
  const insets = useSafeAreaInsets();

  const { pendingParcels } = useParcelContext();
  const [userId, setUserId] = useState<string | null>(null);
  const [myParcels, setMyParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [onlyInProgress, setOnlyInProgress] = useState<boolean>(true);

  // 📷 Permissions caméra via expo-camera
  const [permission, requestPermission] = useCameraPermissions();
  const [scanVisible, setScanVisible] = useState<boolean>(false);
  const [scanningParcel, setScanningParcel] = useState<Parcel | null>(null);
  const [scanPurpose, setScanPurpose] = useState<"PICKUP" | "DELIVERY">("DELIVERY");
  const [scannedOnce, setScannedOnce] = useState<boolean>(false);
  const [scanBusy, setScanBusy] = useState<boolean>(false);
  const [scanMsg, setScanMsg] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        const uid =
          (user as any)?.userId ??
          (user as any)?.username ??
          (user as any)?.signInDetails?.loginId ??
          null;
        setUserId(uid);
      } catch (e) {
        console.log("getCurrentUser error:", e);
      }
    })();
  }, []);

  // Charge les colis assignés à CE livreur
  const loadMyParcels = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await client.models.Parcel.list({
        filter: {
          assignedTo: { eq: userId },
          ...(onlyInProgress
            ? { status: { eq: "IN_PROGRESS" } }
            : {
                or: [
                  { status: { eq: "ASSIGNED" } },
                  { status: { eq: "IN_PROGRESS" } },
                  { status: { eq: "DELIVERING" } },
                ],
              }),
        },
        limit: 200,
        authMode: "userPool",
      });

      const listResult = res;
      const items: Parcel[] =
        (Array.isArray(listResult?.data) && listResult.data.length > 0
          ? listResult.data
          : Array.isArray((listResult as any)?.items)
          ? (listResult as any).items
          : []) as Parcel[];

      // Tri : En cours → En livraison → Assigné, puis par date de création (plus récent en bas)
      const order: Record<string, number> = {
        IN_PROGRESS: 0,
        DELIVERING: 1,
        ASSIGNED: 2,
      };

      items.sort((a, b) => {
        const pa = order[a.status ?? "ASSIGNED"] ?? 9;
        const pb = order[b.status ?? "ASSIGNED"] ?? 9;
        if (pa !== pb) return pa - pb;

        const ca = a.createdAt ? Date.parse(a.createdAt) : 0;
        const cb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return ca - cb;
      });

      setMyParcels(items);
    } catch (e) {
      console.log("loadMyParcels error:", e);
    } finally {
      setLoading(false);
    }
  }, [userId, onlyInProgress]);

  useEffect(() => {
    loadMyParcels();
  }, [loadMyParcels]);

  const fmt = (v?: string | number | null) => (v == null || v === "" ? "—" : String(v));
  const fmtKg = (v?: number | string | null) => {
    if (v == null || v === "") return "—";
    const n = typeof v === "string" ? Number(String(v).replace(",", ".")) : v;
    return Number.isFinite(n as number) ? `${n} kg` : String(v);
  };
  const readableStatus = (s?: Parcel["status"]) =>
    s === "IN_PROGRESS" ? "En cours"
      : s === "DELIVERING" ? "En livraison"
      : s === "ASSIGNED" ? "Assigné"
      : s ?? "—";

  const currentParcelId = useMemo(() => myParcels[0]?.id ?? null, [myParcels]);

  const setDelivering = async (p: Parcel) => {
    if (!p?.id || !userId) return;
    setActingId(String(p.id));
    try {
      await client.models.Parcel.update({
        id: p.id,
        status: "DELIVERING",
        assignedTo: p.assignedTo ?? userId,
        updatedAt: new Date().toISOString(),
        authMode: "userPool",
      });
      await loadMyParcels();
    } catch (e) {
      console.log("setDelivering error:", e);
    } finally {
      setActingId(null);
    }
  };

  // 📷 Ouvre la caméra pour scanner le QR (émétteur ou destinataire)
  const openScanner = async (p: Parcel, purpose: "PICKUP" | "DELIVERY") => {
    if (!permission?.granted) {
      const granted = await requestPermission();
      if (!granted?.granted) {
        setScanMsg("Permission caméra refusée. Autorise la caméra dans les réglages.");
        return;
      }
    }
    setScanningParcel(p);
    setScanPurpose(purpose);
    setScannedOnce(false);
    setScanMsg("");
    setScanVisible(true);
  };

  // Après scan → appelle verifyScan (purpose: PICKUP ou DELIVERY)
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scannedOnce || !scanningParcel?.id) return;
    setScannedOnce(true);
    setScanBusy(true);
    setScanMsg("Vérification…");

    try {
      // data = code signé dans le QR coté client
      const resp = await (client as any).mutations.verifyScan({
        parcelId: String(scanningParcel.id),
        purpose: scanPurpose,
        code: String(data || ""),
        authMode: "userPool",
      });

      const ok =
        resp?.data?.ok ??
        (typeof resp?.data?.verifyScan?.ok === "boolean" ? resp.data.verifyScan.ok : undefined) ??
        resp?.ok;

      if (!ok) {
        setScanMsg("Code invalide ou expiré. Demande au client d’ouvrir son QR depuis l’app.");
        setScanBusy(false);
        setScannedOnce(false);
        return;
      }

      setScanMsg("Validé ✅");

      // Sécurité : force DELIVERED si le resolver ne l’a pas fait
      try {
        await client.models.Parcel.update({
          id: String(scanningParcel.id),
          status: scanPurpose === "PICKUP" ? "IN_PROGRESS" : "DELIVERED",
          assignedTo: scanningParcel.assignedTo ?? userId ?? undefined,
          updatedAt: new Date().toISOString(),
          authMode: "userPool",
        });
      } catch {}

      setTimeout(async () => {
        setScanVisible(false);
        setScanningParcel(null);
        setScanBusy(false);
        setScanMsg("");
        await loadMyParcels();
      }, 450);
    } catch (e) {
      console.log("verifyScan error:", e);
      setScanMsg("Erreur de validation. Réessaie.");
      setScanBusy(false);
      setScannedOnce(false);
    }
  };

  // Fallback manuel (si QR HS)
  const markDelivered = async (p: Parcel) => {
    if (!p?.id || !userId) return;
    setActingId(String(p.id));
    try {
      await client.models.Parcel.update({
        id: p.id,
        status: "DELIVERED",
        assignedTo: p.assignedTo ?? userId,
        updatedAt: new Date().toISOString(),
        authMode: "userPool",
      });
      await loadMyParcels();
    } catch (e) {
      console.log("markDelivered error:", e);
    } finally {
      setActingId(null);
    }
  };

  const renderItem = ({ item, index }: { item: Parcel; index: number }) => {
    const isCurrent = currentParcelId === item.id;
    const isActing = actingId === String(item.id);

    return (
      <View style={[styles.card, isCurrent && styles.currentCard]}>
        <View style={styles.headerRow}>
          <View style={styles.titleIconRow}>
            <IconSymbol
              name={isCurrent ? "paperplane.fill" : "cube.box.fill"}
              size={18}
              color={Colors.accent}
            />
            <Text style={[styles.cardText, styles.cardTitle]}>
              {isCurrent ? "Mission en cours" : "Mission"}
            </Text>
          </View>
          <Text style={[styles.badge, isCurrent && styles.badgePrimary]}>
            {readableStatus(item.status)}
          </Text>
        </View>

        <Text style={styles.cardText}>Type : {fmt(item.type)}</Text>
        <Text style={styles.cardText}>Poids : {fmtKg(item.poids)}</Text>
        {item.dimensions ? <Text style={styles.cardText}>Dimensions : {fmt(item.dimensions)}</Text> : null}
        <Text style={styles.cardText}>Départ : {fmt(item.adresseDepart)}</Text>
        <Text style={styles.cardText}>Arrivée : {fmt(item.adresseArrivee)}</Text>

        <View style={styles.actionsRow}>
          {/* 🟩 Bouton vert : Scanner la validation de réception */}
          {item.status === "ASSIGNED" ? (
            <TouchableOpacity style={[styles.button, styles.validate]} onPress={() => openScanner(item, "PICKUP")}>
              <Text style={styles.validateText}>Scanner retrait</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.validate]}
              onPress={() => openScanner(item, "DELIVERY")}
              disabled={item.status !== "DELIVERING" && item.status !== "IN_PROGRESS"}
            >
              <Text style={styles.validateText}>Scanner réception</Text>
            </TouchableOpacity>
          )}

          {/* Démarrage manuel retiré : le scan pickup déclenche l'étape */}

          {item.status === "IN_PROGRESS" && (
            <TouchableOpacity
              style={[styles.button, styles.secondary]}
              onPress={() => setDelivering(item)}
              disabled={isActing}
            >
              {isActing ? <ActivityIndicator /> : <Text style={styles.buttonText}>En livraison</Text>}
            </TouchableOpacity>
          )}

          {item.status === "DELIVERING" && (
            <TouchableOpacity
              style={[styles.button, styles.ghost]}
              onPress={() => markDelivered(item)}
              disabled={isActing}
            >
              <Text style={styles.ghostText}>Terminer sans scan</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const camDenied = permission && !permission.granted;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mes missions</Text>

      {/* Toggle filtre */}
      <TouchableOpacity
        style={[
          styles.refreshButton,
          {
            marginBottom: 10,
            backgroundColor: onlyInProgress ? Colors.button : "rgba(68, 222, 172, 0.25)",
          },
        ]}
        onPress={() => setOnlyInProgress((v) => !v)}
      >
        <Text style={styles.refreshText}>
          {onlyInProgress ? "Voir tous (assignés + en livraison)" : "Voir uniquement En cours"}
        </Text>
      </TouchableOpacity>

      {loading && myParcels.length === 0 ? (
        <ActivityIndicator />
      ) : myParcels.length === 0 ? (
        <Text style={styles.cardText}>
          Aucun colis {onlyInProgress ? "en cours" : "assigné"} pour le moment.
        </Text>
      ) : (
        <>
          <FlatList
            data={myParcels}
            keyExtractor={(item, index) =>
              (item as any)?.id ? String((item as any).id) : String(index)
            }
            renderItem={renderItem}
          />

          <TouchableOpacity style={styles.refreshButton} onPress={loadMyParcels}>
            <Text style={styles.refreshText}>{loading ? "Chargement…" : "Rafraîchir"}</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Modal Scan Caméra (full-screen, safe area appliquée manuellement) */}
      <Modal
        animationType="slide"
        visible={scanVisible}
        onRequestClose={() => setScanVisible(false)}
        presentationStyle="fullScreen"
        // utile sur Android pour que le contenu passe sous la status bar, puis on padd les insets :
        statusBarTranslucent={Platform.OS === "android"}
      >
        <View
          style={[
            styles.modalSafe,
            {
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              paddingLeft: insets.left,
              paddingRight: insets.right,
            },
          ]}
        >
          <View style={styles.modalInner}>
            <View style={styles.scanHeader}>
              <Text style={styles.scanTitle}>
                {scanPurpose === "PICKUP" ? "Scanner le QR de l'émetteur" : "Scanner le QR du destinataire"}
              </Text>
              <Pressable onPress={() => setScanVisible(false)}>
                <Text style={styles.scanClose}>Fermer ✕</Text>
              </Pressable>
            </View>

            {camDenied ? (
              <View style={styles.scanMsgBox}>
                <Text style={styles.scanMsg}>
                  Permission caméra refusée. Autorise la caméra dans les réglages.
                </Text>
                <TouchableOpacity style={[styles.button, styles.primary]} onPress={requestPermission}>
                  <Text style={styles.buttonText}>Autoriser la caméra</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.scannerFrame}>
                  <CameraView
                    style={styles.cameraFill}
                    facing="back"
                    barcodeScannerSettings={{
                      barcodeTypes: ["qr"],
                    }}
                    onBarcodeScanned={
                      scanBusy
                        ? undefined
                        : ({ data }) => handleBarCodeScanned({ data })
                    }
                  />
                  <View style={styles.scanHintOverlay}>
                    <Text style={styles.scanHintText}>Place le QR dans le cadre</Text>
                  </View>
                </View>

                <View style={styles.scanFooter}>
                  {scanMsg ? <Text style={styles.scanMsg}>{scanMsg}</Text> : null}
                  {scanBusy ? <ActivityIndicator /> : null}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: Colors.background },
  title: { fontSize: 22, marginBottom: 14, textAlign: "center", color: Colors.text },

  card: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    backgroundColor: Colors.card,
  },
  currentCard: { borderColor: Colors.button, borderWidth: 2 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  titleIconRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { fontWeight: "600" },
  cardText: { color: Colors.textOnCard, marginBottom: 4 },

  badge: {
    color: Colors.textOnCard,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgePrimary: { borderColor: Colors.button },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" },

  button: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: Colors.button },
  secondary: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  ghost: { backgroundColor: "transparent", borderWidth: 1, borderColor: Colors.border },
  ghostText: { color: Colors.textOnCard, opacity: 0.8, fontSize: 12 },
  buttonText: { color: Colors.buttonText, fontWeight: "600" },

  // 🟩 Bouton vert "Scanner réception"
  validate: { backgroundColor: Colors.button },
  validateText: { color: Colors.buttonText, fontWeight: "700" },

  refreshButton: {
    backgroundColor: Colors.button,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 6,
    alignItems: "center",
  },
  refreshText: { color: Colors.buttonText, fontWeight: "bold" },

  /* ───────── Modal Camera Layout ───────── */
  modalSafe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalInner: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    // pas de paddingTop ici: on l'applique via insets.top
  },

  scanHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  scanTitle: { fontSize: 18, fontWeight: "700", color: Colors.text },
  scanClose: { color: Colors.textOnCard },

  scannerFrame: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#000",
  },
  cameraFill: { width: "100%", height: "100%" },

  scanHintOverlay: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  scanHintText: { color: "#fff", fontWeight: "600" },

  scanFooter: { paddingVertical: 12, alignItems: "center", gap: 8 },
  scanMsgBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  scanMsg: { color: Colors.textOnCard, textAlign: "center" },
});
