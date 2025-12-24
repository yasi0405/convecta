// app/home/onboarding.tsx
import { createReferralInvite, findUserByPhone, getCurrentUserId, getOrCreateProfile, updateProfile, uploadKycImage } from "@/features/user/api";
import Colors from "@/theme/Colors";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Href, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ---------------------------------------------
// Small UI helpers (styled)
// ---------------------------------------------
function Card({ children, accent = false, style = {} as any }: { children?: React.ReactNode; accent?: boolean; style?: any }) {
  return (
    <View
      style={{
        backgroundColor: accent ? Colors.cardAccent : Colors.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 14,
        gap: 10,
        boxShadow: [
          { offsetX: 0, offsetY: 3, blurRadius: 8, color: "rgba(0, 0, 0, 0.2)" },
        ],
        ...style,
      }}
    >
      {children}
    </View>
  );
}

function Label({ children }: { children?: React.ReactNode }) {
  return <Text style={{ color: Colors.textSecondary }}>{children}</Text>;
}

function Input({ value, onChangeText, placeholder, keyboardType, maxLength, autoCapitalize }:
  { value: string; onChangeText: (t: string) => void; placeholder?: string; keyboardType?: any; maxLength?: number; autoCapitalize?: any; }) {
  return (
    <TextInput
      placeholder={placeholder}
      placeholderTextColor={Colors.textSecondary}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      maxLength={maxLength}
      autoCapitalize={autoCapitalize}
      style={{
        backgroundColor: Colors.input,
        color: Colors.text,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    />
  );
}

function HStack({ children, gap = 10 }: { children?: React.ReactNode; gap?: number }) {
  return <View style={{ flexDirection: "row", gap }}>{children}</View>;
}

function Spacer({ h = 12 }) { return <View style={{ height: h }} />; }

function PrimaryButton({ title, onPress, disabled, full = false }:
  { title: string; onPress: () => void; disabled?: boolean; full?: boolean; }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={{
        backgroundColor: disabled ? "rgba(68, 222, 172, 0.35)" : Colors.button,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        flex: full ? 1 : undefined,
      }}
    >
      <Text style={{ color: Colors.buttonText, fontWeight: "700" }}>{title}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------
// Types
// ---------------------------------------------
type Address = { street: string; postalCode: string; city: string; country?: string };
type Contact = { name: string; phone: string };

// ---------------------------------------------
// Helpers: validation RRN (Belgique)
// ---------------------------------------------
function onlyDigits(s: string) { return s.replace(/\D+/g, ""); }

function isValidBelgianRRN(rrn: string, birthISO?: string): boolean {
  const digits = onlyDigits(rrn);
  if (digits.length !== 11) return false;
  const base9 = digits.slice(0, 9);
  const cc = Number(digits.slice(9));
  const calc = (n: string) => 97 - (Number(n) % 97);
  if (birthISO) {
    const y = Number(birthISO.slice(0, 4));
    const n = y >= 2000 ? `2${base9}` : base9;
    return calc(n) === cc;
  }
  const c1 = calc(base9);
  const c2 = calc(`2${base9}`);
  return cc === c1 || cc === c2;
}

function expectedBelgianRRNChecksum(rrn: string, birthISO?: string): number | null {
  const digits = onlyDigits(rrn);
  if (digits.length < 9) return null;
  const base9 = digits.slice(0, 9);
  const calc = (n: string) => 97 - (Number(n) % 97);
  if (birthISO && /^\d{4}-\d{2}-\d{2}$/.test(birthISO)) {
    const y = Number(birthISO.slice(0, 4));
    const n = y >= 2000 ? `2${base9}` : base9;
    return calc(n);
  }
  return null;
}

// ---------------------------------------------
// Helpers: téléphone / WhatsApp
// ---------------------------------------------
function normalizePhone(raw: string): string {
  let p = (raw || "").trim();
  p = p.replace(/^00/, "+").replace(/[\s().-]/g, "");
  if (!p.startsWith("+") && p.startsWith("0")) p = "+32" + p.slice(1);
  return p;
}

async function openWhatsAppInvite(message: string) {
  const waUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
  const waWeb = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const can = await Linking.canOpenURL(waUrl);
  try { await Linking.openURL(can ? waUrl : waWeb); }
  catch { Alert.alert("Invitation", "Impossible d'ouvrir WhatsApp. Le lien a été copié."); }
}

function buildInviteMessage(inviterName: string, url: string) {
  return `Hello ! ${inviterName} t’invite à rejoindre Convecta pour être référent.\n\nInscris-toi ici : ${url} \n\nTon compte sera automatiquement relié comme personne de contact.`;
}

// ---------------------------------------------
// Hook local: scan du recto + OCR
// ---------------------------------------------
function useIdScanAutoFill(
  onImage: (uri: string) => void,
  onFields: (data: { first_name?: string; last_name?: string; address?: string }) => void
) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);

  async function ensurePermission(): Promise<boolean> {
    if (permission?.granted) return true;
    const res = await requestPermission();
    return !!res.granted;
  }

  async function extractOcrFieldsFromImage(uri: string): Promise<{ first_name?: string; last_name?: string; address?: string; }>
  {
    let TextRecognition: any;
    try {
      const mod = await import("@react-native-ml-kit/text-recognition");
      TextRecognition = mod?.default ?? mod;
    } catch (e) {
      console.warn("ML Kit not available (Expo Go?)", e);
      Alert.alert("OCR non disponible", "L'analyse on-device nécessite un build Dev Client ou un APK/IPA. Continue en manuel.");
      return {};
    }

    const result = await TextRecognition.recognize(uri);
    const fullText = (result?.text || "").replace(/\t/g, " ");
    const lines = fullText.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);

    let first_name: string | undefined;
    let last_name: string | undefined;
    let address: string | undefined;

    for (const l of lines) {
      if (/^[A-ZÉÈÀÂÎÏÔÛÇ][A-ZÉÈÀÂÎÏÔÛÇ\-']+\s+[A-ZÉÈÀÂÎÏÔÛÇ][A-ZÉÈÀÂÎÏÔÛÇ\-']+$/.test(l)) {
        const [ln, fn] = l.split(/\s+/);
        last_name = ln; first_name = fn; break;
      }
    }

    const idx = lines.findIndex((l: string) => /\d+\s+.*(RUE|AVENUE|BD|BOULEVARD|CHAUSS[ÉE]E|CHEMIN|PLACE|ROUTE|ALL[ÉE]E)/i.test(l));
    if (idx >= 0) address = [lines[idx], lines[idx + 1]].filter(Boolean).join(", ");

    return { first_name, last_name, address };
  }

  async function captureFromCamera() {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) {
        setShowCamera(false);
        onImage(photo.uri);
        setOcrLoading(true);
        const fields = await extractOcrFieldsFromImage(photo.uri);
        setOcrLoading(false);
        onFields(fields);
        if (!fields.first_name && !fields.last_name && !fields.address) {
          Alert.alert("OCR", "Aucune donnée lue automatiquement. Tu peux compléter manuellement.");
        }
      }
    } catch (e) {
      setOcrLoading(false);
      console.warn("Camera capture error", e);
      Alert.alert("Erreur", "Capture impossible. Réessaie.");
    }
  }

  async function scanFront() {
    const ok = await ensurePermission();
    if (!ok) { Alert.alert("Permission requise", "Autorise l'accès à la caméra pour scanner ta carte."); return; }
    setShowCamera(true);
  }

  return { scanFront, showCamera, setShowCamera, cameraRef, captureFromCamera, ocrLoading };
}

// ---------------------------------------------
// Composant principal: Wizard 4 écrans
// ---------------------------------------------
export default function Onboarding() {
  const router = useRouter();
  // Stepper
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [birthdate, setBirthdate] = useState(""); // YYYY-MM-DD
  const [rrn, setRRN] = useState(""); // registre national

  // Step 2
  const [addresses, setAddresses] = useState<Address[]>([{ street: "", postalCode: "", city: "", country: "" }]);

  // Step 3
  const [contacts, setContacts] = useState<Contact[]>([{ name: "", phone: "" }]);
  // Step 4
  const [bank_account_holder, setBankHolder] = useState("");
  const [bank_iban, setBankIban] = useState("");
  const [bank_bic, setBankBic] = useState("");

  // Shared (OCR)
  const [frontUri, setFrontUri] = useState<string | undefined>();

  const { scanFront, showCamera, setShowCamera, cameraRef, captureFromCamera, ocrLoading } = useIdScanAutoFill(
    (uri) => setFrontUri(uri),
    ({ first_name, last_name, address }) => {
      if (first_name && !first_nameFieldTouched) setFirst(first_name);
      if (last_name && !last_nameFieldTouched) setLast(last_name);
      if (address) {
        setAddresses((prev) => {
          const next = [...prev];
          if (!next[0]) next[0] = { street: "", postalCode: "", city: "", country: "" };
          if (!next[0].street) next[0].street = address;
          return next;
        });
      }
    }
  );
  const [first_nameFieldTouched, setFirstTouched] = useState(false);
  const [last_nameFieldTouched, setLastTouched] = useState(false);

  // Validations
  const step1Valid = useMemo(() => {
    if (!first_name.trim() || !last_name.trim()) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return false;
    if (!/^\d{2}\d{2}\d{2}\d{3}\d{2}$/.test(rrn.replace(/\D/g, ""))) return false;
    if (!isValidBelgianRRN(rrn, birthdate)) return false;
    // PHOTO OBLIGATOIRE
    if (!frontUri) return false;
    return true;
  }, [first_name, last_name, birthdate, rrn, frontUri]);

  const step2Valid = useMemo(() => {
    const filled = addresses.filter((a) => a.street.trim() && a.postalCode.trim() && a.city.trim());
    return filled.length >= 1;
  }, [addresses]);

  const step3Valid = useMemo(() => {
    const filled = contacts.filter((c) => c.name.trim() && c.phone.trim());
    return filled.length >= 1;
  }, [contacts]);
  const step4Valid = useMemo(() => {
    if (!bank_account_holder.trim()) return false;
    const iban = bank_iban.trim().replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,}$/.test(iban)) return false;
    if (bank_bic.trim() && !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bank_bic.trim().toUpperCase())) return false;
    return true;
  }, [bank_account_holder, bank_iban, bank_bic]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getOrCreateProfile();
        if (!cancelled && (profile.kyc_status === "registered" || profile.kyc_status === "verified")) {
          router.replace("/" as Href);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Navigation
  function goNext() {
    if (step === 1 && step1Valid) setStep(2);
    else if (step === 2 && step2Valid) setStep(3);
    else if (step === 3 && step3Valid) setStep(4);
  }
  function goBack() {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 4) setStep(3);
  }

  // Submit
  async function onSave() {
    if (!step3Valid || !step4Valid) return;
    const cleanAddresses = addresses
      .map((a) => ({
        street: a.street.trim(),
        postalCode: a.postalCode.trim(),
        city: a.city.trim(),
        country: (a.country ?? "").trim(),
      }))
      .filter((a) => a.street || a.postalCode || a.city || a.country);
    const mainAddress =
      cleanAddresses
        .map((a) => [a.street, [a.postalCode, a.city].filter(Boolean).join(" ")].filter(Boolean).join(", "))
        .filter(Boolean)[0] || "";

    const cleanContacts = contacts
      .map((c) => ({
        name: c.name.trim(),
        phone: c.phone.trim(),
      }))
      .filter((c) => c.name || c.phone);

    let kycFrontUrl: string | undefined;
    if (frontUri) {
      kycFrontUrl = await uploadKycImage(frontUri, "front.jpg");
      console.log("Uploaded:", kycFrontUrl);
    }

    const profilePayload: Parameters<typeof updateProfile>[0] = {
      first_name,
      last_name,
      address: mainAddress,
      birthdate,
      national_registry_number: rrn,
      addresses: cleanAddresses,
      contacts: cleanContacts,
      bank_account_holder: bank_account_holder.trim(),
      bank_iban: bank_iban.trim(),
      bank_bic: bank_bic.trim(),
      kyc_status: "registered",
    };
    if (kycFrontUrl) profilePayload.kyc_document_front_url = kycFrontUrl;

    await updateProfile(profilePayload);

    try {
      const inviterId = await getCurrentUserId();
      const inviterLabel = `${first_name} ${last_name}`.trim() || "Un utilisateur Convecta";
      await Promise.all(
        contacts
          .filter((c) => c.name.trim() && c.phone.trim())
          .map(async (c) => {
            const phone = normalizePhone(c.phone);
            const existing = await findUserByPhone(phone);
            if (!existing) {
              const { url } = await createReferralInvite({ inviterId, phone, name: c.name.trim() });
              const msg = buildInviteMessage(inviterLabel, url);
              await openWhatsAppInvite(msg);
            }
          })
      );
    } catch (e) {
      console.warn("Referral/invite step error", e);
    }
    Alert.alert("OK", "Profil enregistré. Vérification en cours.", [
      {
        text: "Continuer",
        onPress: () => router.replace("/" as Href),
      },
    ]);
  }

  // ---------------------------------------------
  // Render
  // ---------------------------------------------
  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.background }}
        contentContainerStyle={{ flexGrow: 1, padding: 16, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
      {/* Header */}
      <HStack>
        <Text style={{ color: Colors.text, fontSize: 18, fontWeight: "700", flex: 1 }}>Onboarding KYC</Text>
        <Text style={{ color: Colors.textSecondary }}>Étape {step}/4</Text>
      </HStack>

      {/* Camera overlay */}
      {showCamera && (
        <Card style={{ padding: 0 }}>
          <View style={{ height: 480, borderRadius: 14, overflow: "hidden" }}>
            <CameraView ref={(r) => (cameraRef.current = r)} style={{ flex: 1 }} facing="back" enableTorch={false} />
            {/* Close */}
            <TouchableOpacity
              onPress={() => setShowCamera(false)}
              style={{ position: "absolute", top: 16, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" }}
              accessibilityLabel="Fermer la caméra"
            >
              <Text style={{ color: Colors.white, fontSize: 22, lineHeight: 22 }}>✕</Text>
            </TouchableOpacity>
            {/* Shutter */}
            <View style={{ position: "absolute", bottom: 24, left: 0, right: 0, alignItems: "center", justifyContent: "center" }}>
              <TouchableOpacity
                onPress={captureFromCamera}
                style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 6, borderColor: Colors.white, backgroundColor: "rgba(255,255,255,0.15)" }}
                accessibilityLabel="Prendre la photo"
              />
            </View>
          </View>
        </Card>
      )}

      {/* STEP 1 */}
      {step === 1 && (
        <Card>
          <Text style={{ color: Colors.text, fontWeight: "700", fontSize: 16 }}>Identité</Text>

          <Label>Prénom</Label>
          <Input
            value={first_name}
            onChangeText={(t) => { setFirstTouched(true); setFirst(t); }}
            autoCapitalize="words"
            placeholder="Jean"
          />

          <Label>Nom</Label>
          <Input
            value={last_name}
            onChangeText={(t) => { setLastTouched(true); setLast(t); }}
            autoCapitalize="characters"
            placeholder="DUPONT"
          />

          <Label>Date de naissance (YYYY-MM-DD)</Label>
          <Input
            value={birthdate}
            onChangeText={setBirthdate}
            keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "number-pad"}
            placeholder="1988-05-21"
          />

          <Label>N° registre national (11 chiffres)</Label>
          <Input
            value={rrn}
            onChangeText={setRRN}
            keyboardType="number-pad"
            maxLength={15}
            placeholder="YYMMDDXXXCC"
          />

          {/* Photo proof required */}
          <Label>Preuve photo du recto de la carte (obligatoire)</Label>
          {frontUri ? (
            <Image source={{ uri: frontUri }} style={{ height: 160, borderRadius: 10 }} />
          ) : (
            <Text style={{ color: Colors.textSecondary }}>Aucune photo. Merci de scanner le recto.</Text>
          )}

          <HStack gap={12}>
            <PrimaryButton title="Scanner recto carte" onPress={scanFront} />
            {ocrLoading && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator />
                <Text style={{ color: Colors.text }}>Analyse…</Text>
              </View>
            )}
          </HStack>

          {!step1Valid && (
            <Text style={{ color: "#ff6b6b" }}>
              Remplis tous les champs au bon format et ajoute une photo du recto de ta carte.
            </Text>
          )}

          {(() => {
            const digits = rrn.replace(/\D/g, "");
            const expected = expectedBelgianRRNChecksum(rrn, birthdate);
            if (digits.length === 11 && !isValidBelgianRRN(rrn, birthdate) && expected !== null) {
              const base9 = digits.slice(0, 9);
              return (
                <Text style={{ color: "#ff6b6b" }}>
                  RRN invalide pour la date {birthdate}. Clé attendue pour {base9} : {String(expected).padStart(2, '0')}.
                </Text>
              );
            }
            return null;
          })()}
        </Card>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <Card>
          <Text style={{ color: Colors.text, fontWeight: "700", fontSize: 16 }}>Adresse(s)</Text>
          {addresses.map((a, idx) => (
            <Card key={`addr-${idx}`} style={{ gap: 12 }}>
              <HStack gap={10}>
                <Text style={{ color: Colors.text, fontWeight: "600", flex: 1 }}>Adresse {idx + 1}</Text>
                {idx > 0 && (
                  <TouchableOpacity onPress={() => setAddresses((prev) => prev.filter((_, i) => i !== idx))} accessibilityLabel={`Supprimer l'adresse ${idx + 1}`}>
                    <IconSymbol name="trash.fill" size={18} color={Colors.accent} />
                  </TouchableOpacity>
                )}
              </HStack>

              <Label>Rue et numéro</Label>
              <Input value={a.street} onChangeText={(t) => setAddresses((prev) => prev.map((p, i) => (i === idx ? { ...p, street: t } : p)))} placeholder="12 Rue des Fleurs" />

              <HStack>
                <View style={{ flex: 1 }}>
                  <Label>Code postal</Label>
                  <Input value={a.postalCode} keyboardType="number-pad" onChangeText={(t) => setAddresses((prev) => prev.map((p, i) => (i === idx ? { ...p, postalCode: t } : p)))} placeholder="75001" />
                </View>
                <View style={{ flex: 2 }}>
                  <Label>Ville</Label>
                  <Input value={a.city} onChangeText={(t) => setAddresses((prev) => prev.map((p, i) => (i === idx ? { ...p, city: t } : p)))} placeholder="Paris" />
                </View>
              </HStack>

              <Label>Pays (optionnel)</Label>
              <Input value={a.country ?? ""} onChangeText={(t) => setAddresses((prev) => prev.map((p, i) => (i === idx ? { ...p, country: t } : p)))} placeholder="Belgique" />
            </Card>
          ))}

          {addresses.length < 3 && (
            <TouchableOpacity onPress={() => setAddresses((prev) => [...prev, { street: "", postalCode: "", city: "", country: "" }])} accessibilityLabel="Ajouter une adresse" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <IconSymbol name="plus.circle.fill" size={22} color={Colors.accent} />
              <Text style={{ color: Colors.text }}>Ajouter une adresse (max 3)</Text>
            </TouchableOpacity>
          )}

          {!step2Valid && (
            <Text style={{ color: "#ff6b6b" }}>Ajoute au moins une adresse complète (rue, code postal, ville).</Text>
          )}
        </Card>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <Card>
          <Text style={{ color: Colors.text, fontWeight: "700", fontSize: 16 }}>Personnes de contact / Référents</Text>
          {contacts.map((c, idx) => (
            <Card key={`ct-${idx}`} style={{ gap: 12 }}>
              <Label>Nom du référent {idx + 1}</Label>
              <Input value={c.name} onChangeText={(t) => setContacts((prev) => prev.map((p, i) => (i === idx ? { ...p, name: t } : p)))} placeholder="Nom" />

              <Label>Téléphone</Label>
              <Input value={c.phone} onChangeText={(t) => setContacts((prev) => prev.map((p, i) => (i === idx ? { ...p, phone: t } : p)))} keyboardType="phone-pad" placeholder="+32..." />

              {idx > 0 && (
                <TouchableOpacity onPress={() => setContacts((prev) => prev.filter((_, i) => i !== idx))} accessibilityLabel="Supprimer ce référent">
                  <IconSymbol name="trash.fill" size={20} color={Colors.accent} />
                </TouchableOpacity>
              )}
            </Card>
          ))}

          <TouchableOpacity onPress={() => setContacts((prev) => [...prev, { name: "", phone: "" }])} accessibilityLabel="Ajouter un référent" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <IconSymbol name="plus.circle.fill" size={22} color={Colors.accent} />
            <Text style={{ color: Colors.text }}>Ajouter une personne de contact</Text>
          </TouchableOpacity>

          {!step3Valid && (
            <Text style={{ color: "#ff6b6b" }}>Ajoute au moins un référent avec nom et téléphone.</Text>
          )}
        </Card>
      )}

      {/* STEP 4 */}
      {step === 4 && (
        <Card>
          <Text style={{ color: Colors.text, fontWeight: "700", fontSize: 16 }}>Coordonnées bancaires</Text>
          <Text style={{ color: Colors.textSecondary }}>
            Ces informations seront utilisées pour connecter ton compte à Stripe. Elles restent confidentielles.
          </Text>

          <Label>Titulaire du compte</Label>
          <Input
            value={bank_account_holder}
            onChangeText={setBankHolder}
            placeholder="Nom complet"
            autoCapitalize="words"
          />

          <Label>IBAN</Label>
          <Input
            value={bank_iban}
            onChangeText={setBankIban}
            placeholder="BE00 0000 0000 0000"
            autoCapitalize="characters"
          />

          <Label>BIC (facultatif)</Label>
          <Input
            value={bank_bic}
            onChangeText={setBankBic}
            placeholder="GEBABEBB"
            autoCapitalize="characters"
          />

          {!step4Valid && (
            <Text style={{ color: "#ff6b6b" }}>
              Renseigne un titulaire et un IBAN valide (BIC optionnel).
            </Text>
          )}
        </Card>
      )}

      {/* Footer navigation */}
      <HStack gap={12}>
        {step > 1 ? (
          <PrimaryButton title="Retour" onPress={goBack} />
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {step < 4 ? (
          <PrimaryButton
            title="Suivant"
            onPress={goNext}
            disabled={
              (step === 1 && !step1Valid) ||
              (step === 2 && !step2Valid) ||
              (step === 3 && !step3Valid)
            }
            full
          />
        ) : (
          <PrimaryButton title="Enregistrer" onPress={onSave} disabled={!step4Valid} full />
        )}
      </HStack>

      <Spacer h={24} />
      </ScrollView>
    </View>
  );
}
