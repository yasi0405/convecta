import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/**
 * 🎯 Convecta — Schéma Data (Parcels + QR sécurisé)
 * - Fix: enregistre bien ScanPurpose dans le schema avant usage
 * - Fix: évite les String! manquants (owner rendu optionnel)
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
  code: a.string(),               // code signé (JWT ou autre)
  purpose: a.ref("ScanPurpose"),  // PICKUP | DELIVERY
  exp: a.datetime(),              // expiration du code
  kid: a.string(),                // key id utilisée pour signer
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
    // NOTE: rendu optionnel pour éviter l'erreur "String!" si non envoyé par l'app
    // Si tu veux forcer l'envoi côté client, ajoute .required() ici.
    owner: a.string(),
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

    // Timestamps (gérés par l’app si tu veux, ils ne sont pas requis)
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  })
  .authorization((allow) => [
    // Lecture publique (landing / liste publique si besoin)
    allow.guest().to(["read"]),
    // Utilisateurs connectés : créer, lire, mettre à jour
    allow.authenticated().to(["create", "read", "update"]),
  ]);

/* ────────────────────────────────────────────────────────────────────────── */
/* Schéma                                                                    */
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
    .handler(a.handler.function("scanFn"))
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
    .handler(a.handler.function("scanFn"))
    .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});