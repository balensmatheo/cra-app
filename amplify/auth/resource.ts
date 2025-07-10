// amplify/auth/resource.ts
import { defineAuth } from '@aws-amplify/backend';
import { postConfirmation } from './post-confirmation/resource';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ['USERS', "ADMINS"],
  triggers: {
    postConfirmation,
  },
  userAttributes: {
    familyName: {
      required: true,
      mutable: true,
    },
    givenName: {
      required: true,
      mutable: true,
    },
  },
  access: (allow) => [
    allow.resource(postConfirmation).to(['addUserToGroup']),
  ],
});
