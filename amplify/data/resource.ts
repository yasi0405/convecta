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

const KycStatus = a.enum(["none", "registered", "pending", "verified", "rejected"]);
const KycProvider = a.enum(["manual", "stripe", "onfido"]);
const KycRequestStatus = a.enum(["pending", "verified", "rejected"]);

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
    type: a.string(),
    poids: a.float(),
    dimensions: a.string(),

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
/* Models additionnels : User / KYC                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const UserProfile = a
  .model({
    sub: a.string().required(),           // Cognito sub
    email: a.email().required(),
    first_name: a.string(),
    last_name: a.string(),
    address: a.string(),
    birthdate: a.string(),
    national_registry_number: a.string(),
    addresses: a.json(), // tableau d'adresses structurées
    contacts: a.json(), // personnes de contact
    kyc_document_front_url: a.string(),
    kyc_status: a.ref("KycStatus").required(), // default handled at create
    createdAt: a.datetime().required(),
    updatedAt: a.datetime().required(),
  })
  .authorization((allow) => [allow.owner()])
  .identifier(["sub"]);

const KycRequest = a
  .model({
    sub: a.string().required(),
    id_front_url: a.string().required(),
    id_back_url: a.string(),
    provider: a.ref("KycProvider").required(), // default handled at create
    status: a.ref("KycRequestStatus").required(), // default handled at create
    reason: a.string(),
    ocr_payload: a.json(),
    mrz: a.string(),
    createdAt: a.datetime().required(),
    updatedAt: a.datetime().required(),
  })
  .authorization((allow) => [allow.owner()])
  .secondaryIndexes((idx) => [idx("sub")]);

/* ────────────────────────────────────────────────────────────────────────── */
/* Schéma principal                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const schema = a.schema({
  ParcelStatus,
  ScanPurpose,
  KycStatus,
  KycProvider,
  KycRequestStatus,
  Parcel,
  GenerateScanCodeResult,
  VerifyScanResult,
  UserProfile,
  KycRequest,

  // Génération d'un QR signé (affiché côté émetteur/récepteur)
  generateScanCode: a
    .mutation()
    .arguments({
      parcelId: a.id().required(),
      purpose: a.ref("ScanPurpose").required(),
    })
    .returns(GenerateScanCodeResult)
    .handler(a.handler.function(scanFn)) 
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
