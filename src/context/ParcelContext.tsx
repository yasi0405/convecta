import React, { createContext, ReactNode, useState } from "react";

// Définition du type Parcel
export interface Parcel {
  type: string;
  poids: string;
  dimensions: string;
  description: string;
  adresse: string;
}

// Définition du type du contexte
interface ParcelContextType {
  pendingParcels: Parcel[];
  addParcel: (parcel: Parcel) => void;
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

  return (
    <ParcelContext.Provider value={{ pendingParcels, addParcel }}>
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