import { defineAuth } from '@aws-amplify/backend';
import { customMessageFn } from "../functions/custom-message/resource";

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  triggers: {
    customMessage: customMessageFn,
  },
});
