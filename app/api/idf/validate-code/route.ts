import { NextRequest, NextResponse } from 'next/server';
import IDFProxy from '@/services/IDFProxy';

const proxy = new IDFProxy();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.idNumber) {
      return NextResponse.json(
        { error: 'idNumber is required' },
        { status: 400 }
      );
    }
    
    if (!body.code) {
      return NextResponse.json(
        { error: 'code is required' },
        { status: 400 }
      );
    }
    
    if (!body.sessionCookie) {
      return NextResponse.json(
        { error: 'sessionCookie is required' },
        { status: 400 }
      );
    }

    const result = await proxy.validateCode(body.idNumber, body.code, body.sessionCookie);
    
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

