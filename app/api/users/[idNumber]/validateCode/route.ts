import { NextRequest, NextResponse } from 'next/server';
import IDFProxy from '@/services/IDFProxy';

const proxy = new IDFProxy();

export async function POST(
  request: NextRequest,
  { params }: { params: { idNumber: string } }
) {
  try {
    const body = await request.json();
    const { idNumber } = params;
    
    if (!body.code) {
      return NextResponse.json(
        { error: 'code is required' },
        { status: 400 }
      );
    }

    const cookieHeader = request.headers.get('cookie') || '';
    const result = await proxy.validateCode(idNumber, body.code, cookieHeader);
    
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

