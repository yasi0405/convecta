import React, { createContext, ReactNode, useState } from "react";

// 🔢 Statuts possibles d’un colis (mêmes valeurs que dans Amplify)
export type ParcelStatus =
  | "AVAILABLE"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "DELIVERING"
  | "DELIVERED"
  | "CANCELLED";

// 🧱 Structure complète d’un colis
export interface Parcel {
  id?: string;
  type?: string;
  poids?: number | string | null;
  dimensions?: string | null;
  description?: string | null;

  adresseDepart?: string | null;
  adresseArrivee?: string | null;

  status?: ParcelStatus;

  // 🔗 Affectation livreur
  assignedTo?: string | null;     // ID Cognito du livreur
  courierName?: string | null;    // Nom public du livreur (affichage)

  // 👤 Créateur / expéditeur
  owner?: string | null;          // ID Cognito du client (expéditeur)

  createdAt?: string | null;
  updatedAt?: string | null;
}

// 📦 Définition du type du contexte
interface ParcelContextType {
  pendingParcels: Parcel[];
  addParcel: (parcel: Parcel) => void;
  setPendingParcels?: React.Dispatch<React.SetStateAction<Parcel[]>>;
  clearPending?: () => void;
}

// 🧭 Création du contexte
export const ParcelContext = createContext<ParcelContextType>({
  pendingParcels: [],
  addParcel: () => {},
});

ParcelContext.displayName = "ParcelContext";

// 🚀 Provider global
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

// 🪄 Hook pratique
export const useParcelContext = () => {
  const context = React.useContext(ParcelContext);
  if (!context) {
    throw new Error("useParcelContext must be used within a ParcelProvider");
  }
  return context;
};