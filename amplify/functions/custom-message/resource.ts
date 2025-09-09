import { defineFunction } from "@aws-amplify/backend";

export const customMessageFn = defineFunction({
  name: "custom-message",
  entry: "./handler.ts",
});