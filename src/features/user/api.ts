import { Data, Storage } from "@/lib/amplify";
import { getCurrentUser } from "aws-amplify/auth";

// ------------------------------------------------------------
// Gestion du profil utilisateur
// ------------------------------------------------------------
type AddressInput = { street: string; postalCode: string; city: string; country?: string };
type ContactInput = { name: string; phone: string };

const serializeJson = <T>(value: T | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return JSON.stringify(value);
};

export async function getOrCreateProfile() {
  const { userId: sub, signInDetails } = await getCurrentUser();
  const email = signInDetails?.loginId ?? "";

  const existing = await Data.models.UserProfile.get({ sub });
  if (existing.data) return existing.data;

  const now = new Date().toISOString();
  const created = await Data.models.UserProfile.create({
    sub,
    email,
    birthdate: "",
    national_registry_number: "",
    addresses: JSON.stringify([]),
    contacts: JSON.stringify([]),
    kyc_document_front_url: "",
    kyc_status: "none",
    createdAt: now,
    updatedAt: now,
  });
  return created.data!;
}

export async function getProfile() {
  const { userId: sub } = await getCurrentUser();
  const { data } = await Data.models.UserProfile.get({ sub });
  return data ?? null;
}

export async function updateProfile(p: Partial<{
  first_name: string;
  last_name: string;
  address: string;
  birthdate: string;
  national_registry_number: string;
  addresses: AddressInput[];
  contacts: ContactInput[];
  kyc_document_front_url: string;
  kyc_status: "none" | "registered" | "pending" | "verified" | "rejected";
}>) {
  const me = await getProfile();
  if (!me) throw new Error("Profile not found");
  const nextPayload: Record<string, any> = {
    sub: me.sub,
    updatedAt: new Date().toISOString(),
  };

  if (p.first_name !== undefined) nextPayload.first_name = p.first_name;
  if (p.last_name !== undefined) nextPayload.last_name = p.last_name;
  if (p.address !== undefined) nextPayload.address = p.address;
  if (p.birthdate !== undefined) nextPayload.birthdate = p.birthdate;
  if (p.national_registry_number !== undefined) nextPayload.national_registry_number = p.national_registry_number;
  if (p.kyc_document_front_url !== undefined) nextPayload.kyc_document_front_url = p.kyc_document_front_url;
  if (p.kyc_status !== undefined) nextPayload.kyc_status = p.kyc_status;

  const serializedAddresses = serializeJson(p.addresses);
  if (serializedAddresses !== undefined) nextPayload.addresses = serializedAddresses;
  const serializedContacts = serializeJson(p.contacts);
  if (serializedContacts !== undefined) nextPayload.contacts = serializedContacts;

  return Data.models.UserProfile.update(nextPayload);
}

async function uriToBlob(localUri: string): Promise<Blob> {
  const response = await fetch(localUri);
  if (!response.ok) throw new Error(`Impossible de lire le fichier: ${response.status}`);
  return await response.blob();
}

export async function uploadKycImage(localUri: string, key: string) {
  const blob = await uriToBlob(localUri);
  const { path } = await Storage.uploadData({
    data: blob,
    path: ({ identityId }) => `kyc/${identityId}/${key}`,
  }).result;

  const { url } = await Storage.getUrl({ path });
  return url.toString();
}

// ------------------------------------------------------------
// Outils additionnels pour Convecta Onboarding
// ------------------------------------------------------------

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "";
const WEB_BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL || "https://convecta.app";

function normalizePhoneToE164(raw: string): string {
  const digits = (raw || "").replace(/\D+/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return raw;
  if (digits.startsWith("00")) return "+" + digits.slice(2);
  if (digits[0] === "0") return "+32" + digits.slice(1); // Belgique par défaut
  return "+" + digits;
}

export async function getCurrentUserId(): Promise<string> {
  try {
    const { userId } = await getCurrentUser();
    return userId || "anonymous";
  } catch (e) {
    console.warn("getCurrentUserId(): fallback to anonymous", e);
    return "anonymous";
  }
}

export async function findUserByPhone(phone: string): Promise<{ id: string } | null> {
  try {
    const e164 = normalizePhoneToE164(phone);
    if (!API_BASE) {
      console.warn("findUserByPhone(): EXPO_PUBLIC_API_URL non défini — return null");
      return null;
    }
    const res = await fetch(`${API_BASE}/users/by-phone?phone=${encodeURIComponent(e164)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data?.id ? { id: String(data.id) } : null;
  } catch (e) {
    console.warn("findUserByPhone():", e);
    return null;
  }
}

export async function createReferralInvite(params: {
  inviterId: string;
  phone: string;
  name?: string;
}): Promise<{ url: string; inviteId: string }> {
  const inviterId = params.inviterId || (await getCurrentUserId());
  const e164 = normalizePhoneToE164(params.phone);
  const payload = { inviterId, phone: e164, name: params.name || "" };

  const defaultInviteId =
    globalThis?.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const defaultUrl = `${WEB_BASE}/signup?ref=${encodeURIComponent(inviterId)}&phone=${encodeURIComponent(
    e164
  )}&invite=${encodeURIComponent(defaultInviteId)}`;

  if (!API_BASE) {
    console.warn("createReferralInvite(): EXPO_PUBLIC_API_URL non défini — fallback sur defaultUrl");
    return { url: defaultUrl, inviteId: defaultInviteId };
  }

  try {
    const res = await fetch(`${API_BASE}/referrals/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      url: data?.url || defaultUrl,
      inviteId: data?.inviteId || defaultInviteId,
    };
  } catch (e) {
    console.warn("createReferralInvite(): fallback defaultUrl", e);
    return { url: defaultUrl, inviteId: defaultInviteId };
  }
}
