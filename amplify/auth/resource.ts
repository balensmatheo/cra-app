import { defineAuth } from '@aws-amplify/backend';
import { postConfirmation } from "./post-confirmation/resource"

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
    
  groups: ["ADMINS", "USERS"],
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
    allow.resource(postConfirmation).to(["addUserToGroup"]),
  ],

});
