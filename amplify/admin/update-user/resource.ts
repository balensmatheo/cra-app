import { defineFunction } from '@aws-amplify/backend';

export const updateUserFn = defineFunction({
  name: 'admin-update-user',
  entry: './handler.ts',
  environment: {
    USER_POOL_ID: process.env.AMPLIFY_AUTH_USERPOOL_ID || process.env.USER_POOL_ID || ''
  },
  timeoutSeconds: 30,
});
