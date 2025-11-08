export type ParcelStatus =
  | 'AWAITING_RECEIVER_CONFIRMATION'
  | 'AWAITING_PICKUP'
  | 'IN_TRANSIT'
  | 'DELIVERED';

export type Parcel = {
  id: string;
  code?: string;
  senderName: string;
  pickupAddressLabel?: string;
  dropoffAddressLabel?: string;
  etaText?: string;
  status: ParcelStatus;
  proposedWindow?: { startISO: string; endISO: string } | null;
  createdAtISO: string;
};