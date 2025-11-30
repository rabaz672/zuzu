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

    const { data, cookies } = await proxy.getUserInfo(body.idNumber);
    
    let sessionCookie = '';
    if (cookies) {
      const cookieArray = cookies.split(';');
      const connectSidCookie = cookieArray.find(c => c.trim().startsWith('connect.sid='));
      if (connectSidCookie) {
        sessionCookie = connectSidCookie.trim();
      } else {
        sessionCookie = cookies.trim();
      }
    }
    
    const response = NextResponse.json({
      mobilePhone: data.mobilePhone,
      sessionCookie: sessionCookie
    });
    
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    
    return response;
  } catch (error: any) {
    const errorResponse = NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    return errorResponse;
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

