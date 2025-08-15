import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({});
const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID || process.env.USER_POOL_ID;

// Handler compatible with Amplify Data custom mutation: uses event.arguments
export const handler = async (event: any) => {
  const email = String(event?.arguments?.email || '').trim().toLowerCase();
  const groups: string[] = Array.isArray(event?.arguments?.groups) ? event.arguments.groups : [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('invalid_email');
  }
  // Idempotence: if user exists, return userExists
  try {
    await client.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: email }));
    return { userExists: true };
  } catch {}
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
  return { username: email };
};
