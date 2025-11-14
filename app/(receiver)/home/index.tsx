import Colors from "@/theme/Colors";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { RECEIVER_CONTENT_TOP_SPACING } from "@constants/index";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddressField } from "@features/receiver/home/components/AddressField";
import { EstimateCard } from "@features/receiver/home/components/EstimateCard";
import { UserAutocomplete } from "@features/receiver/home/components/UserAutocomplete";

import { useAddressAutocomplete } from "@features/receiver/home/hooks/useAddressAutocomplete";
import { useEstimate } from "@features/receiver/home/hooks/useEstimate";
import { createParcel, updateParcel } from "@features/receiver/home/services/parcel";

import type { RecipientMode, RecipientUser } from "@features/receiver/home/types";

const TYPE_OPTIONS = [
  { value: "standard", label: "Envoi standard" },
  { value: "express", label: "Envoi rapide (prise du colis dans les 10 min)" },
] as const;

const notify = (title: string, msg: string) =>
  Platform.OS === "web" ? window.alert(`${title}\n\n${msg}`) : Alert.alert(title, msg);

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const prefill = useMemo(() => {
    if (!params?.prefill || typeof params.prefill !== "string") return null;
    try {
      return JSON.parse(params.prefill);
    } catch {
      return null;
    }
  }, [params.prefill]);

  // Form
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [type, setType] = useState<typeof TYPE_OPTIONS[number]["value"]>("standard");
  const [poids, setPoids] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);

  const [adresseDepart, setAdresseDepart] = useState("");
  const [adresseArrivee, setAdresseArrivee] = useState("");

  const dep = useAddressAutocomplete(adresseDepart);
  const arr = useAddressAutocomplete(adresseArrivee);

  const [recipientMode, setRecipientMode] = useState<RecipientMode>("address");
  const [selectedUser, setSelectedUser] = useState<RecipientUser | null>(null);
  const [userSearchKey, setUserSearchKey] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { loading, err, durationSec, distanceM, commissionEUR } = useEstimate(adresseDepart, adresseArrivee);

  useEffect(() => {
    if (!prefill) return;
    setIsEdit(true);
    setEditId(prefill.id ?? null);
    if (prefill.type && (TYPE_OPTIONS as any).some((opt: any) => opt.value === prefill.type)) {
      setType(prefill.type as any);
    }
    if (prefill.poids != null) setPoids(String(prefill.poids));
    if (prefill.dimensions != null) setDimensions(String(prefill.dimensions));
    if (prefill.adresseDepart != null) setAdresseDepart(String(prefill.adresseDepart));
    if (prefill.adresseArrivee != null) setAdresseArrivee(String(prefill.adresseArrivee));
  }, [prefill]);

  const handleSubmit = async () => {
    if (!type) return setError("Choisis un type d'envoi.");
    if (!adresseDepart?.trim()) return setError("Ajoute une adresse de départ.");
    if (recipientMode === "address") {
      if (!adresseArrivee?.trim()) return setError("Ajoute une adresse d’arrivée (ou choisis un destinataire).");
    } else if (recipientMode === "user") {
      if (!selectedUser) return setError("Choisis un destinataire (Client B).");
      if (!selectedUser.defaultAddressLabel?.trim()) {
        return setError("Ce destinataire n'a pas d'adresse par défaut. Demande-lui de compléter son profil.");
      }
    }

    const poidsNormalized = poids?.trim().replace(",", ".");
    const poidsNum = poidsNormalized ? parseFloat(poidsNormalized) : undefined;

    try {
      setSubmitting(true);
      setError(null);

      if (isEdit && editId) {
        const id = await updateParcel({
          id: editId,
          type,
          poids: poidsNum,
          dimensions,
          adresseDepart,
          adresseArrivee,
        });
        router.replace({ pathname: "/(receiver)/home/summary", params: { id, updated: "1" } });
        return;
      }

      const receiver = selectedUser?.id;
      const arrivalLabel =
        recipientMode === "address"
          ? (adresseArrivee ?? "").trim()
          : (selectedUser?.defaultAddressLabel ?? "").trim();
      const statusForFlow = selectedUser ? "AWAITING_RECEIVER_CONFIRMATION" : "AVAILABLE";

      const id = await createParcel({
        type,
        poids: poidsNum,
        dimensions,
        adresseDepart,
        adresseArrivee: arrivalLabel,
        receiverId: receiver,
        status: statusForFlow,
      });

      // reset soft
      setType("standard"); setTypeOpen(false); setPoids(""); setDimensions("");
      setAdresseDepart(""); setAdresseArrivee("");
      setRecipientMode("address"); setSelectedUser(null); setUserSearchKey((s) => s + 1);

      router.replace({ pathname: "/(receiver)/home/summary", params: { id } });
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de la création du colis");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.container, { paddingBottom: 80 }]}
        keyboardShouldPersistTaps="handled"
      >
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.headerRow}>
        <Text style={styles.title}>{isEdit ? "Modifier le colis" : "Nouveau colis"}</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            setIsEdit(false); setEditId(null);
            setType("standard"); setTypeOpen(false); setPoids(""); setDimensions("");
            setAdresseDepart(""); setAdresseArrivee("");
            setRecipientMode("address"); setSelectedUser(null); setUserSearchKey((s) => s + 1);
          }}
          accessibilityLabel="Réinitialiser le formulaire"
        >
          <IconSymbol name="arrow.clockwise" size={18} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Type d'envoi</Text>
      <View style={styles.dropdownContainer}>
        <TouchableOpacity style={styles.dropdownControl} onPress={() => setTypeOpen((prev) => !prev)} accessibilityLabel="Choisir le type d'envoi">
          <Text style={styles.dropdownValue}>
            {TYPE_OPTIONS.find((opt) => opt.value === type)?.label ?? "Choisir un type"}
          </Text>
          <Text style={styles.dropdownCaret}>{typeOpen ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {typeOpen && (
          <View style={styles.dropdownList}>
            {TYPE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.dropdownOption, type === opt.value && styles.dropdownOptionActive]}
                onPress={() => {
                  setType(opt.value);
                  setTypeOpen(false);
                }}
              >
                <Text style={styles.dropdownOptionText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <AddressField
        label="Adresse de départ"
        value={adresseDepart}
        onChange={setAdresseDepart}
        suggestions={dep.suggestions}
        clearSuggestions={() => dep.setSuggestions([])}
        showGPS={false}
      />

      <Text style={styles.label}>Destinataire</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <TouchableOpacity
          style={[styles.toggleBtn, recipientMode === "address" && styles.toggleBtnActive]}
          onPress={() => setRecipientMode("address")}
        >
          <Text style={[styles.toggleLabel, recipientMode === "address" && styles.toggleLabelActive]}>Adresse</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, recipientMode === "user" && styles.toggleBtnActive]}
          onPress={() => setRecipientMode("user")}
        >
          <Text style={[styles.toggleLabel, recipientMode === "user" && styles.toggleLabelActive]}>Utilisateur</Text>
        </TouchableOpacity>
      </View>

      {recipientMode === "user" ? (
        <UserAutocomplete
          key={userSearchKey}
          value={selectedUser}
          onSelect={(u) => {
            setSelectedUser(u);
            // si adresse par défaut connue, la préremplir
            // (tu peux ajouter un toggle si besoin)
          }}
          onClearSelection={() => setSelectedUser(null)}
        />
      ) : null}

      {recipientMode === "user" && selectedUser ? (
        <View style={styles.selectedUserCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.selectedUserName}>{selectedUser.displayName}</Text>
            <TouchableOpacity onPress={() => {
              setSelectedUser(null);
              setUserSearchKey((s) => s + 1);
            }}>
              <Text style={styles.selectedUserAction}>Changer</Text>
            </TouchableOpacity>
          </View>
          {selectedUser.email ? <Text style={styles.selectedUserMeta}>{selectedUser.email}</Text> : null}
          {selectedUser.defaultAddressLabel ? (
            <Text style={styles.selectedUserAddress}>{selectedUser.defaultAddressLabel}</Text>
          ) : (
            <Text style={styles.selectedUserWarning}>Aucune adresse enregistrée</Text>
          )}
        </View>
      ) : null}

      {recipientMode === "address" ? (
        <AddressField
          label="Adresse d’arrivée"
          value={adresseArrivee}
          onChange={setAdresseArrivee}
          suggestions={arr.suggestions}
          clearSuggestions={() => arr.setSuggestions([])}
        />
      ) : null}

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

      <EstimateCard
        loading={loading}
        err={err}
        durationSec={durationSec}
        distanceM={distanceM}
        commissionEUR={commissionEUR}
      />

      <TouchableOpacity style={[styles.button, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.buttonText}>
          {submitting ? (isEdit ? "Mise à jour…" : "Création…") : (isEdit ? "Mettre à jour" : "Valider")}
        </Text>
      </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1, backgroundColor: Colors.background },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: RECEIVER_CONTENT_TOP_SPACING,
    backgroundColor: Colors.background,
    flexGrow: 1,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 },
  title: { fontSize: 22, textAlign: "left", color: Colors.text, flex: 1 },
  refreshButton: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10, alignItems: "center", justifyContent: "center", width: 44, height: 44 },
  label: { color: Colors.text, marginBottom: 6, marginTop: 10, fontWeight: "600" },
  error: { color: "#b00020", marginBottom: 8, fontWeight: "700" },
  input: { backgroundColor: Colors.input, borderColor: Colors.border, borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8, color: Colors.text },
  toggleBtn: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingVertical: 10, alignItems: "center", backgroundColor: Colors.input },
  toggleBtnActive: { backgroundColor: Colors.card, borderColor: Colors.button },
  toggleLabel: { color: Colors.textOnCard, fontWeight: "600" },
  toggleLabelActive: { color: Colors.button, fontWeight: "700" },
  button: { backgroundColor: Colors.button, paddingVertical: 14, borderRadius: 8, marginTop: 8, alignItems: "center" },
  buttonText: { color: Colors.buttonText, fontSize: 16, fontWeight: "bold" },
  dropdownContainer: { marginBottom: 16 },
  dropdownControl: {
    backgroundColor: Colors.input,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownValue: { color: Colors.text, fontWeight: "600", flex: 1 },
  dropdownCaret: { color: Colors.textSecondary, marginLeft: 8 },
  dropdownList: {
    marginTop: 4,
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  dropdownOption: { paddingVertical: 12, paddingHorizontal: 12 },
  dropdownOptionActive: { backgroundColor: Colors.input },
  dropdownOptionText: { color: Colors.text },
  selectedUserCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginTop: 8,
  },
  selectedUserName: { color: Colors.text, fontWeight: "700", fontSize: 16 },
  selectedUserMeta: { color: Colors.textSecondary, marginTop: 4 },
  selectedUserAddress: { color: Colors.text, marginTop: 8, fontStyle: "italic" },
  selectedUserWarning: { color: "#f87171", marginTop: 8 },
  selectedUserAction: { color: Colors.accent, fontWeight: "600" },
});
