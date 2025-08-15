import { CognitoIdentityProviderClient, ListUsersCommand, AdminListGroupsForUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({});
const userPoolId = process.env.USER_POOL_ID || process.env.AMPLIFY_AUTH_USERPOOL_ID;

export const handler = async (event: any) => {
  try {
    const body = event?.body ? JSON.parse(event.body) : {};
    const search: string | undefined = body.search;
    const params: any = { UserPoolId: userPoolId, Limit: 50 };
    if (search && /^[^*?]{1,50}$/.test(search)) {
      params.Filter = `email ^= \"${search}\"`;
    }
    const res = await client.send(new ListUsersCommand(params));
    const users = res.Users || [];
    const results = [] as any[];
    for (const u of users) {
      const username = u.Username!;
      let groups: string[] = [];
      try {
        const gr = await client.send(new AdminListGroupsForUserCommand({ Username: username, UserPoolId: userPoolId }));
        groups = (gr.Groups || []).map(g => g.GroupName!).filter(Boolean);
      } catch {}
      const attrs: Record<string,string> = {};
      (u.Attributes || []).forEach(a => { if (a.Name && a.Value) attrs[a.Name] = a.Value; });
      results.push({
        username,
        enabled: u.Enabled,
        status: u.UserStatus,
        email: attrs.email || '',
        given_name: attrs.given_name || '',
        family_name: attrs.family_name || '',
        groups,
      });
    }
    return { statusCode: 200, body: JSON.stringify({ users: results }) };
  } catch (e:any) {
    console.error('list-users error', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'error' }) };
  }
};
