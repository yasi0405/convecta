// src/lib/amplify.ts
import { Amplify } from "aws-amplify";
import type { Schema } from "../../amplify/data/resource";

type Outputs = any;
const amplifyOutputs: Outputs = require("../../amplify_outputs.json");

let configured = false;
const GLOBAL_KEY = "__AMPLIFY_CONFIGURED__";

const hasRuntimeConfig = () => {
  const cfg = (Amplify as any)?.getConfig?.();
  return !!cfg && Object.keys(cfg).length > 0;
};

const configureOnce = () => {
  if (configured && hasRuntimeConfig()) return;
  if ((globalThis as any)[GLOBAL_KEY] && hasRuntimeConfig()) {
    configured = true;
    return;
  }

  const raw = amplifyOutputs;

  // Map Amplify Gen2 outputs (raw.auth.*) to Amplify v6 Auth configuration (Auth.Cognito.*)
  const authFromGen2 = raw?.auth
    ? {
        Auth: {
          Cognito: {
            userPoolId: raw.auth.user_pool_id,
            userPoolClientId: raw.auth.user_pool_client_id,
            identityPoolId: raw.auth.identity_pool_id,
          },
        },
      }
    : {};

  const outputs = {
    ...raw,
    ...authFromGen2,
  };

  Amplify.configure(outputs);

  configured = true;
  (globalThis as any)[GLOBAL_KEY] = true;

  if (__DEV__) {
    const cfg = (Amplify as any)?.getConfig?.();
    console.log("[Amplify] using sandbox outputs");
    console.log("[Amplify] Cognito userPoolId=", cfg?.Auth?.Cognito?.userPoolId);
  }
};

// ⚠️ Configure BEFORE importing Data/Storage modules
configureOnce();

// Load Data/Storage only after configure (prevents the warning)
const { generateClient } =
  require("aws-amplify/data") as typeof import("aws-amplify/data");
const { getUrl, uploadData } =
  require("aws-amplify/storage") as typeof import("aws-amplify/storage");

export function ensureAmplifyConfigured() {
  configureOnce();
}

export const Data = generateClient<Schema>();
export const Storage = { getUrl, uploadData };
