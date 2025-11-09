import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import Colors from "@/theme/Colors";
import { getOrCreateProfile, updateProfile } from "@/features/user/api";

type AddressForm = { street: string; postalCode: string; city: string; country?: string };
type ContactForm = { name: string; phone: string };

type FormFields = {
  first_name: string;
  last_name: string;
  birthdate: string;
  national_registry_number: string;
  address: string;
  addresses: AddressForm[];
  contacts: ContactForm[];
  bank_account_holder: string;
  bank_iban: string;
  bank_bic: string;
};

const emptyAddress: AddressForm = { street: "", postalCode: "", city: "", country: "" };
const emptyContact: ContactForm = { name: "", phone: "" };

function parseArray<T>(value: any, fallback: T[]): T[] {
  if (!value) return fallback;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeProfile(data: any): FormFields {
  const addresses = parseArray<AddressForm>(data?.addresses, []);
  const contacts = parseArray<ContactForm>(data?.contacts, []);
  return {
    first_name: data?.first_name ?? "",
    last_name: data?.last_name ?? "",
    birthdate: data?.birthdate ?? "",
    national_registry_number: data?.national_registry_number ?? "",
    address: data?.address ?? "",
    addresses: addresses.length ? addresses : [emptyAddress],
    contacts: contacts.length ? contacts : [emptyContact],
    bank_account_holder: data?.bank_account_holder ?? "",
    bank_iban: data?.bank_iban ?? "",
    bank_bic: data?.bank_bic ?? "",
  };
}

function Field({
  label,
  value,
  editable,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  editable: boolean;
  placeholder?: string;
  onChangeText: (t: string) => void;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: Colors.textSecondary, marginBottom: 6 }}>{label}</Text>
      <TextInput
        value={value}
        editable={editable}
        onChangeText={onChangeText}
        placeholder={editable ? placeholder : undefined}
        placeholderTextColor={Colors.textSecondary}
        style={{
          backgroundColor: Colors.input,
          borderColor: Colors.border,
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: Colors.text,
        }}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const [form, setForm] = useState<FormFields>(normalizeProfile(null));
  const [snapshot, setSnapshot] = useState<FormFields>(normalizeProfile(null));
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getOrCreateProfile();
        const normalized = normalizeProfile(data);
        setForm(normalized);
        setSnapshot(normalized);
      } catch (e) {
        Alert.alert("Erreur", "Impossible de charger le profil.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  const dirty = editing && JSON.stringify(form) !== JSON.stringify(snapshot);

  async function handlePrimaryAction() {
    if (!editing) {
      setEditing(true);
      return;
    }
    if (!dirty) return;
    setSaving(true);
    try {
      await updateProfile(form);
      const refreshed = await getOrCreateProfile();
      const normalized = normalizeProfile(refreshed);
      setForm(normalized);
      setSnapshot(normalized);
      setEditing(false);
      Alert.alert("Profil", "Modifications enregistrées.");
    } catch (e) {
      Alert.alert("Erreur", "Impossible d'enregistrer les modifications.");
    } finally {
      setSaving(false);
    }
  }

  function handleChange<K extends keyof FormFields>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCancelEdit() {
    setForm(snapshot);
    setEditing(false);
  }

  const handleAddressChange = (idx: number, key: keyof AddressForm, value: string) => {
    setForm((prev) => {
      const nextAddresses = prev.addresses.map((addr, i) =>
        i === idx ? { ...addr, [key]: value } : addr
      );
      return { ...prev, addresses: nextAddresses };
    });
  };

  const handleContactChange = (idx: number, key: keyof ContactForm, value: string) => {
    setForm((prev) => {
      const nextContacts = prev.contacts.map((ct, i) =>
        i === idx ? { ...ct, [key]: value } : ct
      );
      return { ...prev, contacts: nextContacts };
    });
  };

  const addAddress = () => {
    setForm((prev) => {
      if (prev.addresses.length >= 3) return prev;
      return { ...prev, addresses: [...prev.addresses, { ...emptyAddress }] };
    });
  };

  const removeAddress = (idx: number) => {
    setForm((prev) => {
      const next = prev.addresses.filter((_, i) => i !== idx);
      return { ...prev, addresses: next.length ? next : [{ ...emptyAddress }] };
    });
  };

  const addContact = () => {
    setForm((prev) => {
      if (prev.contacts.length >= 5) return prev;
      return { ...prev, contacts: [...prev.contacts, { ...emptyContact }] };
    });
  };

  const removeContact = (idx: number) => {
    setForm((prev) => {
      const next = prev.contacts.filter((_, i) => i !== idx);
      return { ...prev, contacts: next.length ? next : [{ ...emptyContact }] };
    });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: Colors.text, fontSize: 20, fontWeight: "700" }}>Mon profil</Text>
          {editing && (
            <TouchableOpacity onPress={handleCancelEdit}>
              <Text style={{ color: Colors.textSecondary }}>Annuler</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ backgroundColor: Colors.card, borderRadius: 14, padding: 16 }}>
          <Text style={{ color: Colors.text, fontWeight: "600", marginBottom: 12 }}>Identité</Text>
          <Field
            label="Prénom"
            value={form.first_name}
            editable={editing}
            placeholder="Jean"
            onChangeText={(t) => handleChange("first_name", t)}
          />
          <Field
            label="Nom"
            value={form.last_name}
            editable={editing}
            placeholder="Dupont"
            onChangeText={(t) => handleChange("last_name", t)}
          />
          <Field
            label="Date de naissance"
            value={form.birthdate}
            editable={editing}
            placeholder="1988-05-21"
            onChangeText={(t) => handleChange("birthdate", t)}
          />
          <Field
            label="N° registre national"
            value={form.national_registry_number}
            editable={editing}
            placeholder="YYMMDDXXXCC"
            onChangeText={(t) => handleChange("national_registry_number", t)}
          />
          <Field
            label="Adresse principale"
            value={form.address}
            editable={editing}
            placeholder="12 Rue des Fleurs, 1000 Bruxelles"
            onChangeText={(t) => handleChange("address", t)}
          />
        </View>

        <View style={{ backgroundColor: Colors.card, borderRadius: 14, padding: 16 }}>
          <Text style={{ color: Colors.text, fontWeight: "600", marginBottom: 12 }}>Adresses enregistrées</Text>
          {form.addresses.map((addr, idx) => (
            <View key={`addr-${idx}`} style={{ marginBottom: 16, borderBottomWidth: idx === form.addresses.length - 1 ? 0 : 1, borderBottomColor: Colors.border, paddingBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ color: Colors.text, fontWeight: "600" }}>Adresse {idx + 1}</Text>
                {editing && (
                  <TouchableOpacity onPress={() => removeAddress(idx)}>
                    <Text style={{ color: Colors.textSecondary }}>Supprimer</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Field
                label="Rue et numéro"
                value={addr.street}
                editable={editing}
                placeholder="12 Rue des Fleurs"
                onChangeText={(t) => handleAddressChange(idx, "street", t)}
              />
              <Field
                label="Code postal"
                value={addr.postalCode}
                editable={editing}
                placeholder="75001"
                onChangeText={(t) => handleAddressChange(idx, "postalCode", t)}
              />
              <Field
                label="Ville"
                value={addr.city}
                editable={editing}
                placeholder="Paris"
                onChangeText={(t) => handleAddressChange(idx, "city", t)}
              />
              <Field
                label="Pays"
                value={addr.country ?? ""}
                editable={editing}
                placeholder="Belgique"
                onChangeText={(t) => handleAddressChange(idx, "country", t)}
              />
            </View>
          ))}
          {editing && form.addresses.length < 3 && (
            <TouchableOpacity onPress={addAddress} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: Colors.accent, fontSize: 20 }}>➕</Text>
              <Text style={{ color: Colors.text }}>Ajouter une adresse (max 3)</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ backgroundColor: Colors.card, borderRadius: 14, padding: 16 }}>
          <Text style={{ color: Colors.text, fontWeight: "600", marginBottom: 12 }}>Contacts référents</Text>
          {form.contacts.map((ct, idx) => (
            <View key={`ct-${idx}`} style={{ marginBottom: 16, borderBottomWidth: idx === form.contacts.length - 1 ? 0 : 1, borderBottomColor: Colors.border, paddingBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ color: Colors.text, fontWeight: "600" }}>Référent {idx + 1}</Text>
                {editing && (
                  <TouchableOpacity onPress={() => removeContact(idx)}>
                    <Text style={{ color: Colors.textSecondary }}>Supprimer</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Field
                label="Nom"
                value={ct.name}
                editable={editing}
                placeholder="Nom"
                onChangeText={(t) => handleContactChange(idx, "name", t)}
              />
              <Field
                label="Téléphone"
                value={ct.phone}
                editable={editing}
                placeholder="+32..."
                onChangeText={(t) => handleContactChange(idx, "phone", t)}
              />
            </View>
          ))}
          {editing && form.contacts.length < 5 && (
            <TouchableOpacity onPress={addContact} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: Colors.accent, fontSize: 20 }}>➕</Text>
              <Text style={{ color: Colors.text }}>Ajouter un référent (max 5)</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ backgroundColor: Colors.card, borderRadius: 14, padding: 16 }}>
          <Text style={{ color: Colors.text, fontWeight: "600", marginBottom: 12 }}>Coordonnées bancaires</Text>
          <Field
            label="Titulaire du compte"
            value={form.bank_account_holder}
            editable={editing}
            placeholder="Nom complet"
            onChangeText={(t) => handleChange("bank_account_holder", t)}
          />
          <Field
            label="IBAN"
            value={form.bank_iban}
            editable={editing}
            placeholder="BE00 0000 0000 0000"
            onChangeText={(t) => handleChange("bank_iban", t)}
          />
          <Field
            label="BIC"
            value={form.bank_bic}
            editable={editing}
            placeholder="GEBABEBB"
            onChangeText={(t) => handleChange("bank_bic", t)}
          />
        </View>
      </ScrollView>

      <View style={{ padding: 16 }}>
        <TouchableOpacity
          onPress={handlePrimaryAction}
          disabled={editing && !dirty || saving}
          style={{
            backgroundColor: editing ? Colors.accent : Colors.button,
            opacity: editing && !dirty ? 0.4 : 1,
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: Colors.buttonText, fontWeight: "700" }}>
            {editing ? "Enregistrer" : "Modifier"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
