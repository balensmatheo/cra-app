import { defineAuth } from '@aws-amplify/backend';
import { postConfirmation } from "./post-confirmation/resource"
import { listUsersFn } from '../data/list_user/resource.js';
import { createUserFn } from '../data/create_user/resource.js';

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
    allow.resource(listUsersFn).to(['listUsers','listGroupsForUser']),
    allow.resource(createUserFn).to(['createUser','addUserToGroup','getUser']),
  ],

});
