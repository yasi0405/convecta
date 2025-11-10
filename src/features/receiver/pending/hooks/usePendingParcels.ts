import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import { useCallback, useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ParcelWithAssign } from "../types";

const client = generateClient<any>();

export function usePendingParcels() {
  const insets = useSafeAreaInsets();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myPendingParcels, setMyPendingParcels] = useState<ParcelWithAssign[]>([]);
  const [takenParcels, setTakenParcels] = useState<ParcelWithAssign[]>([]);
  const [loadingMyPending, setLoadingMyPending] = useState(false);
  const [loadingTaken, setLoadingTaken] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [qrParcel, setQrParcel] = useState<ParcelWithAssign | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        const uid =
          (user as any)?.userId ??
          (user as any)?.username ??
          (user as any)?.signInDetails?.loginId ??
          null;
        setCurrentUserId(uid);
      } catch (e) {
        console.log("getCurrentUser error:", e);
      }
    })();
  }, []);

  const loadMyPendingParcels = useCallback(async () => {
    if (!currentUserId) return;
    setLoadingMyPending(true);
    try {
      const res = await client.models.Parcel.list({
        filter: {
          owner: { eq: currentUserId },
          and: [
            { or: [{ status: { eq: "AVAILABLE" } }, { status: { eq: null as any } }] },
            {
              or: [
                { assignedTo: { attributeExists: false } as any },
                { assignedTo: { eq: null as any } },
                { assignedTo: { eq: "" as any } },
              ],
            },
          ],
        },
        limit: 100,
        authMode: "userPool",
      });
      const items: ParcelWithAssign[] = res?.data ?? (res as any)?.items ?? [];
      setMyPendingParcels(items);
    } catch (e) {
      console.log("loadMyPendingParcels error:", e);
    } finally {
      setLoadingMyPending(false);
    }
  }, [currentUserId]);

  const loadTakenParcels = useCallback(async () => {
    if (!currentUserId) return;
    setLoadingTaken(true);
    try {
      const res = await client.models.Parcel.list({
        filter: {
          owner: { eq: currentUserId },
          or: [
            { status: { eq: "ASSIGNED" } },
            { status: { eq: "IN_PROGRESS" } },
            { status: { eq: "DELIVERING" } },
          ],
        },
        limit: 100,
        authMode: "userPool",
      });
      const items: ParcelWithAssign[] = res?.data ?? (res as any)?.items ?? [];
      setTakenParcels(items);
    } catch (e) {
      console.log("loadTakenParcels error:", e);
    } finally {
      setLoadingTaken(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadMyPendingParcels();
    loadTakenParcels();
  }, [loadMyPendingParcels, loadTakenParcels]);

  const showQrForParcel = useCallback(
    async (parcel: ParcelWithAssign) => {
      if (!parcel?.id) return;
      setQrParcel(parcel);
      setQrValue(null);
      setQrError(null);
      setQrLoading(true);
      setQrVisible(true);
      try {
        const resp = await (client as any).mutations.generateScanCode({
          parcelId: String(parcel.id),
          purpose: "DELIVERY",
          authMode: "userPool",
        });
        const data =
          resp?.data?.generateScanCode ??
          resp?.data ??
          resp?.generateScanCode ??
          resp;
        const code = data?.code ? String(data.code) : null;
        if (!code) {
          setQrError("Impossible de générer le QR pour ce colis.");
        } else {
          setQrValue(code);
        }
      } catch (e: any) {
        setQrError(e?.message ?? "Erreur lors de la génération du QR.");
      } finally {
        setQrLoading(false);
      }
    },
    []
  );

  return {
    myPendingParcels,
    takenParcels,
    loadMyPendingParcels,
    loadTakenParcels,
    loadingMyPending,
    loadingTaken,
    qrVisible,
    setQrVisible,
    qrValue,
    qrParcel,
    qrError,
    qrLoading,
    insets,
    showQrForParcel,
  };
}
