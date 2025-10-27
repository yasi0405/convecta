import type { Handler } from "aws-lambda";

// Petits utilitaires
const nowISO = () => new Date().toISOString();
const minutesFromNow = (m: number) => new Date(Date.now() + m * 60 * 1000).toISOString();

// Validation minimaliste
function assert(cond: any, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

export const handler: Handler = async (event: any) => {
  // 👀 Rendez le debug facile en cas de pépin :
  // console.log("scanFn event:", JSON.stringify(event));

  // Amplify Gen-2: selon les versions, fieldName peut être à différents endroits… ou absent.
  const fieldName =
    event?.info?.fieldName ??
    event?.fieldName ??
    event?.ctx?.info?.fieldName ??
    undefined;

  // 🔹 Récupération des arguments
  const args = event?.arguments ?? {};
  const { parcelId, purpose, code } = args;

  // 🧭 Routage robuste :
  // - Si `code` est fourni -> verifyScan
  // - Sinon -> generateScanCode
  // - Et en dernier recours, on tente via fieldName si présent
  const isVerify = typeof code === "string" && code.length > 0;
  const isGenerate = !isVerify;

  try {
    // ✅ Cas generateScanCode
    if (isGenerate || fieldName === "generateScanCode") {
      assert(typeof parcelId === "string" && parcelId.trim() !== "", "parcelId requis");
      assert(typeof purpose === "string" && purpose.trim() !== "", "purpose requis");

      // TODO: ici tu peux signer un JWT / stocker hash/TTL en base
      const issuedAt = Date.now();
      const exp = minutesFromNow(5);

      return {
        code: `QR-${parcelId}-${purpose}-${issuedAt}`, // placeholder
        purpose,
        exp,
        kid: "demo-key",
      };
    }

    // ✅ Cas verifyScan
    if (isVerify || fieldName === "verifyScan") {
      assert(typeof parcelId === "string" && parcelId.trim() !== "", "parcelId requis");
      assert(typeof purpose === "string" && purpose.trim() !== "", "purpose requis");
      assert(typeof code === "string" && code.trim() !== "", "code requis");

      // TODO: vérifier le code (signature/TTL) + MAJ du statut en base si besoin
      const newStatus = purpose === "PICKUP" ? "IN_PROGRESS" : "DELIVERED";

      return {
        ok: true,
        newStatus,
        parcelId,
        stampedAt: nowISO(),
      };
    }

    // Si on arrive ici, on n'a pas reconnu l'intention
    throw new Error(`Unsupported invocation: field=${fieldName ?? "undefined"} args=${JSON.stringify(Object.keys(args))}`);
  } catch (err: any) {
    // Laisser AppSync voir un message clair
    console.error("scanFn error:", err?.message ?? err);
    throw err;
  }
};