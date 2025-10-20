import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  ParcelStatus: a.enum(["AVAILABLE", "ASSIGNED", "DELIVERED"]),

  Parcel: a
    .model({
      type: a.string().required(),
      poids: a.float(),
      dimensions: a.string(),
      description: a.string(),
      adresse: a.string(),
      status: a.ref("ParcelStatus").required(),
      createdAt: a.datetime(),
      updatedAt: a.datetime(),
    })
    .authorization((allow: any) => [
      allow.guest().to(["read"]),                         // invités : lecture
      allow.authenticated().to(["create", "read", "update"]), // utilisateurs connectés (via Identity Pool "authenticated")
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    // ✅ Version compatible : un seul mode, Identity Pool
    defaultAuthorizationMode: 'identityPool',
  },
});