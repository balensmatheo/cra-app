import { defineFunction } from "@aws-amplify/backend";

export const deleteUserFn = defineFunction({
  name: "admin-delete-user",
  entry: "./handler.ts",
  timeoutSeconds: 30,
  environment: {
    UUSER_POOL_ID: process.env.AMPLIFY_AUTH_USERPOOL_ID || process.env.USER_POOL_ID || ''
  },
});
