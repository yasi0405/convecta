import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/**
 * 🎯 Modèle Convecta — Parcels
 * - Statuts étendus (IN_PROGRESS, DELIVERING, CANCELLED)
 * - Traçage du livreur (assignedTo, courierName)
 * - Traçage du créateur (owner)
 * - Auth:
 *    - Invités: lecture (ex: voir des colis publics / écran d'accueil)
 *    - Utilisateurs connectés: create/read/update
 *    - ⚠️ Les écritures côté app doivent utiliser { authMode: "userPool" }
 */

const schema = a.schema({
  // 🔢 Statuts de la livraison
  ParcelStatus: a.enum([
    "AVAILABLE",   // visible par tous (non réservé)
    "ASSIGNED",    // réservé par un livreur (en attente de prise en charge)
    "IN_PROGRESS", // pris en charge / en préparation
    "DELIVERING",  // en cours d'acheminement
    "DELIVERED",   // livré
    "CANCELLED",   // annulé
  ]),

  // 📦 Modèle Parcel
  Parcel: a
    .model({
      // — Données métier —
      type: a.string().required(),
      poids: a.float(),
      dimensions: a.string(),
      description: a.string(),

      adresseDepart: a.string().required(),
      adresseArrivee: a.string().required(),

      status: a.ref("ParcelStatus").required(),

      // — Affectation livreur —
      assignedTo: a.string(),   // ID du livreur (souvent sub Cognito)
      courierName: a.string(),  // Nom affichable (optionnel)

      // — Traçage expéditeur —
      owner: a.string(),        // ID du créateur/expéditeur (sub Cognito)

      // — Timestamps (gérés par l'app) —
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow) => [
      // 🟡 Invités: lecture seule (ex: découvrir l'app)
      allow.guest().to(["read"]),

      // 🔵 Utilisateurs authentifiés: peuvent créer/lire/mettre à jour leurs colis
      // (Côté app, utilise { authMode: "userPool" } pour les mutations)
      allow.authenticated().to(["create", "read", "update"]),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    // ⚠️ Par défaut: identityPool (guests possibles)
    // Pour les écritures, passe explicitement { authMode: "userPool" } côté app.
    defaultAuthorizationMode: "identityPool",
    // Si tu veux basculer sur userPool en défaut:
    // defaultAuthorizationMode: "userPool",
    // et garde allow.guest() ci-dessus pour laisser la lecture aux invités.
  },
});

/**
 * 🧪 Rappels côté App :
 * - Création du colis :
 *    await client.models.Parcel.create({
 *      type, adresseDepart, adresseArrivee,
 *      status: "AVAILABLE",
 *      owner: currentUserId,               // ← important pour filtrer côté expéditeur
 *    }, { authMode: "userPool" });
 *
 * - Acceptation par livreur :
 *    await client.models.Parcel.update({
 *      id: parcelId,
 *      status: "IN_PROGRESS",              // ou "ASSIGNED" → "IN_PROGRESS"
 *      assignedTo: courierUserId,
 *      courierName: courierDisplayName,    // optionnel mais top pour l'UI
 *      updatedAt: new Date().toISOString(),
 *    }, { authMode: "userPool" });
 *
 * - Filtre côté expéditeur (pending / pris en charge) :
 *    client.models.Parcel.list({
 *      filter: {
 *        owner: { eq: currentUserId },
 *        or: [
 *          { status: { eq: "ASSIGNED" } },
 *          { status: { eq: "IN_PROGRESS" } },
 *          { status: { eq: "DELIVERING" } },
 *        ],
 *      },
 *    });
 */