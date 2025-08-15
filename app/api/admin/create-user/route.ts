import { NextRequest, NextResponse } from 'next/server';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider';
import amplifyConfig from '../../../../amplify_outputs.json';

export const dynamic = 'force-dynamic';

function genTempPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const fnUrl = process.env.ADMIN_CREATE_USER_URL;
    if (fnUrl) {
      const r = await fetch(fnUrl, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      const text = await r.text();
      return new NextResponse(text, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' } });
    }
    const email = (body.email as string | undefined)?.trim().toLowerCase();
    const groups = Array.isArray(body.groups) ? (body.groups as string[]) : [];
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
    }
    const userPoolId = (amplifyConfig as any)?.auth?.user_pool_id as string | undefined;
    if (!userPoolId) return NextResponse.json({ error: 'USER_POOL_ID manquant' }, { status: 500 });

    const client = new CognitoIdentityProviderClient({});
    const tempPassword = genTempPassword(14);

    // Create user and let Cognito send the invitation email with the temporary password
    await client.send(new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      TemporaryPassword: tempPassword,
      DesiredDeliveryMediums: ['EMAIL'],
      MessageAction: undefined, // default => send invite
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
      ],
      ForceAliasCreation: false,
    }));

    // Assign groups (optional)
    for (const g of groups) {
      try {
        await client.send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: email, GroupName: g }));
      } catch {}
    }

    return NextResponse.json({ ok: true, username: email });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'error' }, { status: 500 });
  }
}
