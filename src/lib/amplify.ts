// src/lib/amplify.ts
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { getUrl, uploadData } from "aws-amplify/storage";
import type { Schema } from "../../amplify/data/resource";
import outputs from "../../amplify_outputs.json";

let configured = false;
export function ensureAmplifyConfigured() {
  if (!configured) {
    Amplify.configure(outputs);
    configured = true;
  }
}

export const Data = generateClient<Schema>();
export const Storage = { getUrl, uploadData };