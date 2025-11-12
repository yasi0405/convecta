import type { Parcel } from '../types.js';

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
  return mockIncomingParcels();
}

export async function getIncomingParcel(id: string): Promise<Parcel> {
  const parcels = await mockIncomingParcels();
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
  await new Promise((r) => setTimeout(r, 400));
  // Ici: mutation Amplify pour confirmer le créneau
  console.log('CONFIRM WINDOW', { parcelId, startISO, endISO });
  return { ok: true };
}
