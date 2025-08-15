import { defineAuth } from '@aws-amplify/backend';
import { postConfirmation } from "./post-confirmation/resource"
import { listUsersFn } from '../admin/list-users/resource';
import { createUserFn } from '../admin/create-user/resource';
import { updateUserFn } from '../admin/update-user/resource';

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
    // Grant admin management actions to our admin functions
    allow.resource(listUsersFn).to([
      'listUsers',
      'listGroupsForUser',
    ]),
    allow.resource(createUserFn).to([
      'createUser',
      'addUserToGroup',
    ]),
    allow.resource(updateUserFn).to([
      'addUserToGroup',
      'removeUserFromGroup',
      'enableUser',
      'disableUser',
      'listGroupsForUser',
    ]),
  ],

});
