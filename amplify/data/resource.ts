import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  ParcelStatus: a.enum(["AVAILABLE", "ASSIGNED", "DELIVERED"]),

  Parcel: a
    .model({
      type: a.string(),
      poids: a.float(),
      dimensions: a.string(),
      description: a.string(),
      adresse: a.string(),
      status: a.ref("ParcelStatus"),
      createdAt: a.datetime(),
    })
    // Guests can read the available parcels (listing for public marketplace)
    // You can tighten this later to authenticated-only if needed
    .authorization((allow) => [allow.guest().to(["read"]), allow.authenticated()]),

  Todo: a
    .model({
      content: a.string(),
    })
    .authorization((allow) => [allow.guest()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'identityPool',
  },
});
