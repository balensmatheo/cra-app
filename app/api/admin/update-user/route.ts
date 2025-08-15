import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(()=>({}));
    return NextResponse.json({ error: 'Not wired', received: body }, { status: 501 });
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'error' }, { status: 500 });
  }
}
