import { Parcel } from "@/context/ParcelContext";

export type ParcelWithAssign = Parcel & {
  id?: string;
  owner?: string | null;
  status?: "AVAILABLE" | "ASSIGNED" | "IN_PROGRESS" | "DELIVERING" | "DELIVERED" | "CANCELLED";
  assignedTo?: string | null;
  courierName?: string | null;
  adresseDepart?: string | null;
  adresseArrivee?: string | null;
  type?: string | null;
  poids?: number | string | null;
  dimensions?: string | null;
};
