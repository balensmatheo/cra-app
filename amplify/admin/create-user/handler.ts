import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({});
const userPoolId = process.env.USER_POOL_ID || process.env.AMPLIFY_AUTH_USERPOOL_ID;

export const handler = async (event: any) => {
  try {
    const body = event?.body ? JSON.parse(event.body) : {};
    const email = (body.email as string | undefined)?.trim().toLowerCase();
    const groups: string[] = Array.isArray(body.groups) ? body.groups : [];
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email invalide' }) };
    }

    // Create user with Cognito to trigger email invitation
    await client.send(new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      DesiredDeliveryMediums: ['EMAIL'],
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
      ],
      ForceAliasCreation: false,
    }));

    for (const g of groups) {
      try {
        await client.send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: email, GroupName: g }));
      } catch {}
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, username: email }) };
  } catch (e: any) {
    console.error('create-user error', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'error' }) };
  }
};
