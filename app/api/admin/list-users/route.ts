import { NextRequest, NextResponse } from 'next/server';
import { CognitoIdentityProviderClient, ListUsersCommand, AdminListGroupsForUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import amplifyConfig from '../../../../amplify_outputs.json';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(()=>({}));
    // If an Amplify Function URL is provided, proxy to it (uses IAM on platform)
    const fnUrl = process.env.ADMIN_LIST_USERS_URL;
    if (fnUrl) {
      const r = await fetch(fnUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const text = await r.text();
      return new NextResponse(text, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' } });
    }
    const search: string | undefined = body.search;
    const userPoolId = (amplifyConfig as any)?.auth?.user_pool_id as string | undefined;
    if (!userPoolId) return NextResponse.json({ error: 'USER_POOL_ID missing' }, { status: 500 });

  const client = new CognitoIdentityProviderClient({});
    const params: any = { UserPoolId: userPoolId, Limit: 50 };
    if (search && /^[^*?]{1,50}$/.test(search)) {
      params.Filter = `email ^= "${search}"`;
    }
    const res = await client.send(new ListUsersCommand(params));
    const users = res.Users || [];
    const results: any[] = [];
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
    return NextResponse.json({ users: results });
  } catch (e:any) {
    console.error('list-users route error', e);
    return NextResponse.json({ error: e.message || 'error' }, { status: 500 });
  }
}
