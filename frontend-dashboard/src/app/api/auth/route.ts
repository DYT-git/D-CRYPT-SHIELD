import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    
    // Read valid codes from .env, fallback to SAHYOG-ADMIN with standard demo aliases
    const validCodesString = process.env.OFFICER_CODES || 'SAHYOG-ADMIN,ADMIN,I4C,MHA,OFFICER,DEMO';
    const validCodes = validCodesString.split(',').map(c => c.trim().toUpperCase());

    if (code && validCodes.includes(code.trim().toUpperCase())) {
      return NextResponse.json({ success: true, role: 'officer' });
    }
    
    return NextResponse.json({ success: false, error: 'Invalid Clearance Code' }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
