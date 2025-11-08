import { generateClient } from "aws-amplify/data";
import { useRouter } from "expo-router";
import { ParcelWithAssign } from "../types";

const client = generateClient<any>();
const router = useRouter();

// Génère un QR pour la livraison
export async function handleShowDeliveryQR(p: ParcelWithAssign) {
  try {
    const resp = await (client as any).mutations.generateScanCode({
      parcelId: String(p.id),
      purpose: "DELIVERY",
      authMode: "userPool",
    });
    console.log("QR Generated", resp);
  } catch (e) {
    console.log("generateScanCode error:", e);
  }
}

// Redirige vers /home avec pré-remplissage
export function handleEditParcel(p: ParcelWithAssign) {
  const prefill = {
    id: p.id,
    type: p.type ?? "",
    description: p.description ?? "",
    poids: p.poids ?? "",
    dimensions: p.dimensions ?? "",
    adresseDepart: p.adresseDepart ?? "",
    adresseArrivee: p.adresseArrivee ?? "",
    status: p.status ?? "",
  };
  router.push({
    pathname: "/home",
    params: { prefill: JSON.stringify(prefill) },
  });
}