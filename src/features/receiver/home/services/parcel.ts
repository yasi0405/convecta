import type { Schema } from "@amplify/data/resource";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";

const client = generateClient<Schema>();

export async function createParcel(input: {
  type: string;
  poids?: number;
  dimensions?: string;
  adresseDepart: string;
  adresseArrivee: string;
  receiverId?: string;
  status: string;
}) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) throw new Error("Non connecté");
  const ownerId = (user as any)?.username || (user as any)?.userId || "unknown";
  const now = new Date().toISOString();

  // @ts-ignore
  const res = await client.models.Parcel.create(
    {
      type: input.type?.trim(),
      poids: input.poids,
      dimensions: input.dimensions?.trim(),
      adresseDepart: input.adresseDepart.trim(),
      adresseArrivee: input.adresseArrivee.trim(),
      status: input.status,
      owner: ownerId,
      receiverId: input.receiverId ?? ownerId,
      createdAt: now,
      updatedAt: now,
    } as any,
    { authMode: "userPool" }
  );

  return (res as any)?.data?.id as string;
}

export async function updateParcel(input: {
  id: string;
  type?: string;
  poids?: number;
  dimensions?: string;
  adresseDepart?: string;
  adresseArrivee?: string;
}) {
  const now = new Date().toISOString();
  // @ts-ignore
  const res = await client.models.Parcel.update(
    { ...input, type: input.type?.trim(), updatedAt: now } as any,
    { authMode: "userPool" }
  );
  return (res as any)?.data?.id as string;
}
