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
    
    return NextResponse.json({
      mobilePhone: data.mobilePhone,
      sessionCookie: sessionCookie
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

