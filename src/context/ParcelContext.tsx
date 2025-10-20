import React, { createContext, ReactNode, useState } from "react";

// Statuts possibles d'un colis
export type ParcelStatus = "AVAILABLE" | "ASSIGNED" | "DELIVERED";

// Définition du type Parcel (mise à jour)
export interface Parcel {
  id?: string;
  type?: string;
  poids?: number | string | null;
  dimensions?: string | null;
  description?: string | null;

  // ⬇️ Nouveaux champs (remplacent `adresse`)
  adresseDepart?: string | null;
  adresseArrivee?: string | null;

  status?: ParcelStatus;
  createdAt?: string | null;
  updatedAt?: string | null;
}

// Définition du type du contexte
interface ParcelContextType {
  pendingParcels: Parcel[];
  addParcel: (parcel: Parcel) => void;
  // (optionnel) utilitaires pratiques si besoin plus tard
  setPendingParcels?: React.Dispatch<React.SetStateAction<Parcel[]>>;
  clearPending?: () => void;
}

// Création du contexte
export const ParcelContext = createContext<ParcelContextType>({
  pendingParcels: [],
  addParcel: () => {},
});

// Nom pour debug
ParcelContext.displayName = "ParcelContext";

// Provider
export const ParcelProvider = ({ children }: { children: ReactNode }) => {
  const [pendingParcels, setPendingParcels] = useState<Parcel[]>([]);

  const addParcel = (parcel: Parcel) => {
    setPendingParcels((prev) => [...prev, parcel]);
  };

  const clearPending = () => setPendingParcels([]);

  return (
    <ParcelContext.Provider
      value={{ pendingParcels, addParcel, setPendingParcels, clearPending }}
    >
      {children}
    </ParcelContext.Provider>
  );
};

// Hook personnalisé
export const useParcelContext = () => {
  const context = React.useContext(ParcelContext);
  if (!context) {
    throw new Error("useParcelContext must be used within a ParcelProvider");
  }
  return context;
};