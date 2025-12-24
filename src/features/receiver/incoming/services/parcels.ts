import type { Parcel, ParcelStatus } from '../types.js';
import type { Schema } from "@amplify/data/resource";
import { ensureAmplifyConfigured } from "@/lib/amplify";
import { generateClient } from "aws-amplify/data";

ensureAmplifyConfigured();

const client = generateClient<Schema>();

type BackendParcel = Schema["Parcel"]["type"];

// Cache local pour refléter immédiatement l'état confirmé même si le backend mock/fallback est utilisé.
const localStatusOverrides = new Map<
  string,
  { status: ParcelStatus; proposedWindow?: { startISO: string; endISO: string } | null }
>();

function mapStatusFromBackend(status?: BackendParcel["status"] | null): ParcelStatus | null {
  switch (status) {
    case "AVAILABLE":
      return "AWAITING_RECEIVER_CONFIRMATION";
    case "ASSIGNED":
      return "AWAITING_PICKUP";
    case "IN_PROGRESS":
    case "DELIVERING":
      return "IN_TRANSIT";
    case "DELIVERED":
      return "DELIVERED";
    default:
      return null;
  }
}

function applyLocalOverrides(parcels: Parcel[]): Parcel[] {
  return parcels.map((p) => {
    const override = localStatusOverrides.get(p.id);
    if (!override) return p;
    return {
      ...p,
      status: override.status,
      proposedWindow: override.proposedWindow ?? p.proposedWindow,
    };
  });
}

// NOTE: branchement Amplify à réaliser ici quand ton schéma est prêt.
// Pour l’instant, on renvoie des données mockées pour débloquer l’écran.

async function mockIncomingParcels(): Promise<Parcel[]> {
  await new Promise((r) => setTimeout(r, 250));
  const now = new Date();
  const start = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const end = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();

  return [
    {
      id: 'PX-001',
      code: 'CV-7F3A',
      senderName: 'Client A (Martine D.)',
      pickupAddressLabel: 'Ixelles — Place Flagey',
      dropoffAddressLabel: 'Bruxelles — Rue du Midi',
      status: 'AWAITING_RECEIVER_CONFIRMATION',
      proposedWindow: { startISO: start, endISO: end },
      createdAtISO: new Date().toISOString(),
    },
    {
      id: 'PX-002',
      code: 'CV-92B1',
      senderName: 'Client A (Boulangerie P.)',
      pickupAddressLabel: 'Uccle — Churchill',
      dropoffAddressLabel: 'Saint-Gilles — Parvis',
      etaText: '~1 h',
      status: 'AWAITING_PICKUP',
      proposedWindow: { startISO: start, endISO: end },
      createdAtISO: new Date().toISOString(),
    },
    {
      id: 'PX-003',
      code: 'CV-55Q9',
      senderName: 'Client A (Atelier K.)',
      pickupAddressLabel: 'Etterbeek',
      dropoffAddressLabel: 'Forest',
      etaText: '~20 min',
      status: 'IN_TRANSIT',
      proposedWindow: null,
      createdAtISO: new Date().toISOString(),
    },
  ];
}

export async function listIncomingParcels(): Promise<Parcel[]> {
  try {
    const res = await client.models.Parcel.list(
      { authMode: "userPool" }
    );
    const items = Array.isArray(res?.data) ? res.data : (res as any)?.items ?? [];
    const mapped: Parcel[] = items
      .map((item: any) => {
        const status = mapStatusFromBackend(item?.status);
        if (!status) return null;
        return {
          id: String(item?.id ?? ""),
          code: item?.code ?? item?.id,
          senderName: item?.owner ?? "Client",
          pickupAddressLabel: item?.adresseDepart,
          dropoffAddressLabel: item?.adresseArrivee,
          status,
          proposedWindow: item?.proposedWindow ?? null,
          createdAtISO: item?.createdAt ?? new Date().toISOString(),
        } satisfies Parcel;
      })
      .filter(Boolean) as Parcel[];

    if (mapped.length) {
      return applyLocalOverrides(mapped);
    }
  } catch (e) {
    console.log("listIncomingParcels fallback to mock:", e);
  }

  return applyLocalOverrides(await mockIncomingParcels());
}

export async function getIncomingParcel(id: string): Promise<Parcel> {
  const parcels = applyLocalOverrides(await mockIncomingParcels());
  const parcel = parcels.find((p) => p.id === id);
  if (!parcel) {
    throw new Error('Colis introuvable');
  }
  return parcel;
}

export async function confirmReceptionWindow(
  parcelId: string,
  startISO: string,
  endISO: string
): Promise<{ ok: true }> {
  const window = { startISO, endISO };

  try {
    await client.models.Parcel.update(
      {
        id: parcelId,
        status: "ASSIGNED", // correspond à "en attente de prise en charge" côté UI
        updatedAt: new Date().toISOString(),
      } as any,
      { authMode: "userPool" }
    );
  } catch (e) {
    console.log("confirmReceptionWindow (fallback mock):", e);
  } finally {
    // Même en cas d'erreur réseau, on reflète localement le nouveau statut + créneau sélectionné
    localStatusOverrides.set(parcelId, { status: "AWAITING_PICKUP", proposedWindow: window });
  }

  return { ok: true };
}
