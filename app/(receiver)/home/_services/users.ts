import type { Schema } from "@/amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import type { ConvectaUser, RecipientUser } from "../types";

const client = generateClient<Schema>();

export async function listAllUsers(
  opts: { pageSize?: number; maxPages?: number; authMode?: "userPool" | "apiKey" | "iam" | "oidc" } = {}
): Promise<ConvectaUser[]> {
  const pageSize = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 50;
  const authMode = opts.authMode ?? "userPool";

  const results: ConvectaUser[] = [];
  let nextToken: string | undefined | null = undefined;
  let pages = 0;

  while (pages < maxPages) {
    // @ts-ignore: signature peut varier selon la génération
    const res = await (client as any)?.models?.User?.list?.({ limit: pageSize, nextToken, authMode });
    const items: any[] = res?.data ?? [];
    results.push(
      ...items.map((u: any) => ({
        id: u.id,
        displayName: u.displayName || u.name || u.username || undefined,
        email: u.email || undefined,
        createdAt: u.createdAt || undefined,
      }))
    );
    nextToken = res?.nextToken;
    pages++;
    if (!nextToken) break;
  }
  return results;
}

export async function searchUsers(query: string): Promise<RecipientUser[]> {
  if (!query?.trim()) return [];
  // ⚠️ Démo: list puis filtre côté client. À remplacer par une query filtrée serveur si grosse base.
  const all = await listAllUsers({ pageSize: 100, maxPages: 10, authMode: "userPool" });
  const q = query.trim().toLowerCase();
  return all
    .filter(u => (u.displayName?.toLowerCase().includes(q) ?? false) || (u.email?.toLowerCase().includes(q) ?? false))
    .slice(0, 20)
    .map(u => ({
      id: u.id,
      displayName: u.displayName || u.email || "Utilisateur",
      email: u.email,
      defaultAddressLabel: undefined,
    }));
}