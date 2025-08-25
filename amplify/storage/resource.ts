import { defineStorage } from '@aws-amplify/backend';

// Storage configuration for user profile photos.
// We'll use the "protected" access level; the client SDK scopes to identity automatically.
export const storage = defineStorage({
  name: 'appStorage',
  access: (allow) => ({
    'protected/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['ADMINS', 'USERS']).to(['read', 'write', 'delete']),
    ],
    'public/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['ADMINS', 'USERS']).to(['read', 'write', 'delete']),
    ],
  }),
});
