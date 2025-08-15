import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { listUsersFn } from './admin/list-users/resource';
import { createUserFn } from './admin/create-user/resource';
import { updateUserFn } from './admin/update-user/resource';
import { storage } from './storage/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
defineBackend({ auth, data, listUsersFn, createUserFn, updateUserFn, storage });
