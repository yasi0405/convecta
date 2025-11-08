import Colors from "@/theme/Colors";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export function EstimateCard({
  loading,
  err,
  durationSec,
  distanceM,
  commissionEUR,
}: {
  loading: boolean;
  err: string | null;
  durationSec: number | null;
  distanceM: number | null;
  commissionEUR: number | null;
}) {
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
  const fmtEUR = (n?: number | null) => (n == null || !Number.isFinite(n)) ? "—" : `${n.toFixed(2)} €`;

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Text style={styles.title}>Estimation</Text>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator />
            <Text style={styles.hint}> Calcul en cours…</Text>
          </View>
        ) : null}
      </View>

      {err ? (
        <Text style={styles.error}>{err}</Text>
      ) : (
        <View style={styles.bottomRow}>
          <View style={styles.bottomCol}>
            <Text style={styles.bottomLabel}>Temps estimé</Text>
            <Text style={styles.bottomBig}>{fmtETA(durationSec)}</Text>
            <Text style={styles.bottomHint}>{fmtKm(distanceM)}</Text>
          </View>

          <View style={[styles.bottomCol, styles.bottomColRight]}>
            <Text style={styles.bottomLabel}>Frais estimés</Text>
            <Text style={styles.bottomBig}>{fmtEUR(commissionEUR)}</Text>
            <Text style={styles.bottomHint}>1€ + 0.4€/km</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  title: { color: Colors.textOnCard, fontWeight: "700", fontSize: 14 },
  loading: { flexDirection: "row", alignItems: "center" },
  hint: { color: Colors.textOnCard, opacity: 0.7, marginLeft: 8, fontSize: 12 },
  error: { color: "#ff6b6b" },
  bottomRow: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border, flexDirection: "row", gap: 12 },
  bottomCol: { flex: 1 },
  bottomColRight: { alignItems: "flex-end" },
  bottomLabel: { color: Colors.textOnCard, opacity: 0.8, fontSize: 12, marginBottom: 2 },
  bottomBig: { color: Colors.textOnCard, fontSize: 20, fontWeight: "800" },
  bottomHint: { color: Colors.textOnCard, fontSize: 11, opacity: 0.7, marginTop: 2 },
});