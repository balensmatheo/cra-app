import { CognitoIdentityProviderClient, AdminGetUserCommand, AdminListGroupsForUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({});
const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID || process.env.USER_POOL_ID;

// Handler: expects event.arguments.sub (username) and returns a user object or null
export const handler = async (event: any) => {
  const sub: string | undefined = event?.arguments?.sub;
  if (!sub) {
    return { user: null };
  }
  try {
    const res = await client.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: sub }));
    const attrs: Record<string, string> = {};
    (res.UserAttributes || []).forEach(a => { if (a.Name && a.Value) attrs[a.Name] = a.Value; });
    let groups: string[] = [];
    try {
      const gr = await client.send(new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: sub }));
      groups = (gr.Groups || []).map(g => g.GroupName!).filter(Boolean);
    } catch {}
    return {
      user: {
        username: sub,
        enabled: res.Enabled,
        status: res.UserStatus,
        email: attrs.email || '',
        given_name: attrs.given_name || '',
        family_name: attrs.family_name || '',
        groups,
      }
    };
  } catch (e) {
    // Not found or not accessible
    return { user: null };
  }
};
