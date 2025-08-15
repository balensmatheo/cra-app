import { defineFunction } from "@aws-amplify/backend";

export const getUserFn = defineFunction({
  name: "admin-get-user",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  environment: {
    USER_POOL_ID: process.env.AMPLIFY_AUTH_USERPOOL_ID || process.env.USER_POOL_ID || ''
  },
});
