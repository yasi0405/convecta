import { Data, Storage } from "@/lib/amplify";
import { getCurrentUser } from "aws-amplify/auth";

export async function getOrCreateProfile() {
  const { userId: sub, signInDetails } = await getCurrentUser();
  const email = signInDetails?.loginId ?? "";

  const existing = await Data.models.UserProfile.get({ sub });
  if (existing.data) return existing.data;

  const now = new Date().toISOString();
  const created = await Data.models.UserProfile.create({
    sub, email, kyc_status: "none", createdAt: now, updatedAt: now,
  });
  return created.data!;
}

export async function getProfile() {
  const { userId: sub } = await getCurrentUser();
  const { data } = await Data.models.UserProfile.get({ sub });
  return data ?? null;
}

export async function updateProfile(p: Partial<{
  first_name: string; last_name: string; address: string;
}>) {
  const me = await getProfile();
  if (!me) throw new Error("Profile not found");
  return Data.models.UserProfile.update({
    sub: me.sub, ...p, updatedAt: new Date().toISOString(),
  });
}

export async function uploadKycImage(localUri: string, key: string) {
  const { path } = await Storage.uploadData({
    data: { uri: localUri } as any,
    path: ({ identityId }) => `kyc/${identityId}/${key}`,
  }).result; // Amplify Storage v6 returns the result under .result

  const { url } = await Storage.getUrl({ path });
  return url.toString();
}