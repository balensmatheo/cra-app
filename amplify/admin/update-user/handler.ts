import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand, AdminRemoveUserFromGroupCommand, AdminEnableUserCommand, AdminDisableUserCommand, AdminListGroupsForUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({});
const userPoolId = process.env.USER_POOL_ID || process.env.AMPLIFY_AUTH_USERPOOL_ID;

export const handler = async (event: any) => {
  try {
    const body = event?.body ? JSON.parse(event.body) : {};
    const { username, enable, disable, addGroups = [], removeGroups = [] } = body;
    if (!username) return { statusCode: 400, body: JSON.stringify({ error: 'username required' }) };
    if (enable && disable) return { statusCode: 400, body: JSON.stringify({ error: 'conflicting enable/disable' }) };
    if (enable) {
      await client.send(new AdminEnableUserCommand({ UserPoolId: userPoolId, Username: username }));
    } else if (disable) {
      await client.send(new AdminDisableUserCommand({ UserPoolId: userPoolId, Username: username }));
    }
    for (const g of addGroups) {
      try { await client.send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: username, GroupName: g })); } catch {}
    }
    for (const g of removeGroups) {
      try { await client.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: userPoolId, Username: username, GroupName: g })); } catch {}
    }
    let groups: string[] = [];
    try {
      const gr = await client.send(new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: username }));
      groups = (gr.Groups || []).map(g => g.GroupName!).filter(Boolean);
    } catch {}
    return { statusCode: 200, body: JSON.stringify({ ok: true, groups }) };
  } catch (e:any) {
    console.error('update-user error', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'error' }) };
  }
};
