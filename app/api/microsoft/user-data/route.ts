import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const response = await fetch('https://home.idf.il/api/auth', {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'authorization': `Bearer ${body.token}`,
        'content-type': 'application/json',
        'origin': 'https://www.home.idf.il',
        'referer': 'https://www.home.idf.il/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        fetchUserData: true,
        isCivil: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Failed to fetch user data: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

