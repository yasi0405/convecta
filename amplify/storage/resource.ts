import { defineStorage } from "@aws-amplify/backend";

/**
 * Bucket used for Convecta uploads (KYC pictures, etc.)
 * - Files are isolated per Cognito Identity: kyc/{identityId}/...
 * - Users can read/write only their own objects.
 */
export const storage = defineStorage({
  name: "convectaUploads",
  access: (allow) => ({
    "kyc/{entity_id}/*": [allow.entity("identity").to(["read", "write"])],
  }),
});
