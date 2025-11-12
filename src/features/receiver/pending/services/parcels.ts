import { router } from "expo-router";
import { ParcelWithAssign } from "../types";

// Redirige vers /home avec pré-remplissage
export function handleEditParcel(p: ParcelWithAssign) {
  const prefill = {
    id: p.id,
    type: p.type ?? "",
    poids: p.poids ?? "",
    dimensions: p.dimensions ?? "",
    adresseDepart: p.adresseDepart ?? "",
    adresseArrivee: p.adresseArrivee ?? "",
    status: p.status ?? "",
  };
  router.push({
    pathname: "/(receiver)/home",
    params: { prefill: JSON.stringify(prefill) },
  });
}
