import { type ClientSchema, a, defineData, defineFunction } from "@aws-amplify/backend";

/**
 * 🎯 Convecta — Schéma Data (Parcels + QR sécurisé)
 * - Fix: référence directe à la Lambda scanFn
 * - Fix: évite les String! manquants (owner rendu optionnel)
 * - Fix: corrige la définition de ScanPurpose et ParcelStatus
 */

/* ────────────────────────────────────────────────────────────────────────── */
/* Enums                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

const ParcelStatus = a.enum([
  "AVAILABLE",
  "ASSIGNED",
  "IN_PROGRESS",
  "DELIVERING",
  "DELIVERED",
  "CANCELLED",
]);

const ScanPurpose = a.enum(["PICKUP", "DELIVERY"]);

/* ────────────────────────────────────────────────────────────────────────── */
/* Custom Types                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

const GenerateScanCodeResult = a.customType({
  code: a.string(),              // code signé (JWT ou autre)
  purpose: a.ref("ScanPurpose"), // PICKUP | DELIVERY
  exp: a.datetime(),             // expiration du code
  kid: a.string(),               // key id utilisée pour signer
});

const VerifyScanResult = a.customType({
  ok: a.boolean(),
  newStatus: a.string(),
  parcelId: a.id(),
  stampedAt: a.datetime(),
});

/* ────────────────────────────────────────────────────────────────────────── */
/* Models                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

const Parcel = a
  .model({
    // Métier
    type: a.string().required(),
    poids: a.float(),
    dimensions: a.string(),
    description: a.string(),

    adresseDepart: a.string().required(),
    adresseArrivee: a.string().required(),

    status: a.ref("ParcelStatus").required(),

    // Affectation livreur
    assignedTo: a.string(),
    courierName: a.string(),

    // Acteurs
    owner: a.string(), // rendu optionnel
    receiverId: a.string(),

    // QR sécurisés (hash/exp et traces de scan)
    pickupCodeHash: a.string(),
    pickupCodeExp: a.datetime(),
    pickupScannedAt: a.datetime(),
    pickupScannedBy: a.string(),

    deliveryCodeHash: a.string(),
    deliveryCodeExp: a.datetime(),
    deliveredAt: a.datetime(),
    deliveryScannedBy: a.string(),

    // Paiement
    paymentIntentId: a.string(),
    paymentStatus: a.string(),

    // Timestamps
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  })
  .authorization((allow) => [
    allow.guest().to(["read"]),
    allow.authenticated().to(["create", "read", "update"]),
  ]);

/* ────────────────────────────────────────────────────────────────────────── */
/* Lambda Functions                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

// 🔹 Déclaration explicite de la Lambda utilisée par les mutations QR
export const scanFn = defineFunction({
  name: "scanFn",
  entry: "../functions/scanFn.ts", // chemin relatif à ce fichier
});

/* ────────────────────────────────────────────────────────────────────────── */
/* Schéma principal                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const schema = a.schema({
  ParcelStatus,
  ScanPurpose,
  Parcel,
  GenerateScanCodeResult,
  VerifyScanResult,

  // Génération d'un QR signé (affiché côté émetteur/récepteur)
  generateScanCode: a
    .mutation()
    .arguments({
      parcelId: a.id().required(),
      purpose: a.ref("ScanPurpose").required(),
    })
    .returns(GenerateScanCodeResult)
    .handler(a.handler.function(scanFn)) // ✅ référence correcte à la Lambda
    .authorization((allow) => [allow.authenticated()]),

  // Vérification d'un QR (scan côté livreur)
  verifyScan: a
    .mutation()
    .arguments({
      parcelId: a.id().required(),
      purpose: a.ref("ScanPurpose").required(),
      code: a.string().required(),
    })
    .returns(VerifyScanResult)
    .handler(a.handler.function(scanFn)) // ✅ même handler
    .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});