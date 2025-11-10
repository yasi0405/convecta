import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { handleEditParcel } from "../services/parcels";
import { styles } from "../styles";
import { ParcelWithAssign } from "../types";

export default function ParcelCard({
  parcel,
  mode,
  onShowQr,
}: {
  parcel: ParcelWithAssign;
  mode: "pending" | "taken";
  onShowQr?: (parcel: ParcelWithAssign) => void;
}) {
  const fmt = (v?: string | number | null) => (v == null || v === "" ? "—" : String(v));
  const fmtKg = (v?: number | string | null) => (v ? `${v} kg` : "—");
  const statusFR = (s?: ParcelWithAssign["status"]) =>
    s === "ASSIGNED"
      ? "Assigné"
      : s === "IN_PROGRESS"
      ? "En cours"
      : s === "DELIVERING"
      ? "En livraison"
      : s === "DELIVERED"
      ? "Livré"
      : s ?? "—";

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>📦 {fmt(parcel.type ?? "Colis")}</Text>
        {mode === "pending" ? (
          <TouchableOpacity style={styles.editButton} onPress={() => handleEditParcel(parcel)}>
            <Text style={styles.editButtonText}>Modifier</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.qrButton} onPress={() => onShowQr?.(parcel)}>
            <Text style={styles.qrButtonText}>Valider (QR)</Text>
          </TouchableOpacity>
        )}
      </View>
      {parcel.adresseDepart ? <Text style={styles.cardText}>Départ : {fmt(parcel.adresseDepart)}</Text> : null}
      {parcel.adresseArrivee ? <Text style={styles.cardText}>Arrivée : {fmt(parcel.adresseArrivee)}</Text> : null}
      <Text style={styles.badge}>Statut : {statusFR(parcel.status)}</Text>
    </View>
  );
}
