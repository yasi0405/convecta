
export const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN as string;

export const COMMISSION_BASE_EUR = 1;      // 1€ dès le départ
export const COMMISSION_EUR_PER_KM = 0.4;  // 0.4€/km

export type Suggestion = { id: string; label: string; coords?: { lat: number; lng: number } };

export type RecipientMode = "address" | "user";

export type RecipientUser = {
  id: string;
  displayName: string;
  email?: string;
  defaultAddressLabel?: string;
};

export type ConvectaUser = {
  id: string;
  displayName?: string;
  email?: string;
  createdAt?: string;
};

export type ParcelStatus =
  | "AWAITING_RECEIVER_CONFIRMATION"
  | "AWAITING_PICKUP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "AVAILABLE";

export type Parcel = {
  id: string;
  code?: string;
  senderName?: string;
  adresseDepart?: string;
  adresseArrivee?: string;
  etaText?: string;
  status: ParcelStatus;
  scheduledWindow?: { startISO: string; endISO: string } | null;
  createdAt?: string;
  updatedAt?: string;
};