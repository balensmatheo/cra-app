import { CognitoIdentityProviderClient, AdminListGroupsForUserCommand, AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({});
const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID || process.env.USER_POOL_ID;

// Only delete if the user is NOT in ADMINS group. Expects event.identity (caller) and event.arguments.sub (target)
export const handler = async (event: any) => {
  const sub: string | undefined = event?.arguments?.sub;
  if (!sub) return { ok: false, reason: 'missing_sub' };

  // Safety: never allow deletion of the caller's own account via this flow
  const callerSub: string | undefined = event?.identity?.sub || event?.identity?.username || undefined;
  if (callerSub && callerSub === sub) {
    return { ok: false, reason: 'cannot_delete_self' };
  }

  // Check target groups, deny if in ADMINS
  try {
    const groupsRes = await client.send(new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: sub }));
    const groups = (groupsRes.Groups || []).map(g => g.GroupName!).filter(Boolean);
    if (groups.includes('ADMINS')) {
      return { ok: false, reason: 'target_is_admin' };
    }
  } catch (e) {
    // If user not found, return success-like response (idempotent)
    return { ok: true, deleted: false, reason: 'not_found' };
  }

  // Proceed delete
  try {
    await client.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: sub }));
    return { ok: true, deleted: true };
  } catch (e) {
    return { ok: false, reason: 'delete_failed' };
  }
};
