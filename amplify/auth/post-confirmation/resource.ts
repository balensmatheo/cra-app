// amplify/auth/post-confirmation/resource.ts
import { defineFunction } from '@aws-amplify/backend';

export const postConfirmation = defineFunction({
  name: 'post-confirmation',
  environment: {
    GROUP_NAME: 'USERS',
  },
  resourceGroupName: 'auth', // obligatoire pour que la fonction soit liée à Cognito
});
