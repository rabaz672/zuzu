import { NextRequest, NextResponse } from 'next/server';
import IDFProxy from '@/services/IDFProxy';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const proxy = new IDFProxy();
    const url = 'https://home.idf.il/api/auth';
    
    const headers: Record<string, string> = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7,ar;q=0.6',
      'authorization': `Bearer ${body.token}`,
      'cache-control': 'no-cache',
      'content-type': 'application/json',
      'origin': 'https://www.home.idf.il',
      'pragma': 'no-cache',
      'priority': 'u=1, i',
      'referer': 'https://www.home.idf.il/',
      'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
    };

    console.log('Sending request to:', url);
    console.log('Authorization header:', `Bearer ${body.token.substring(0, 50)}...`);
    console.log('Request body:', JSON.stringify({ fetchUserData: true, isCivil: false }));

    const response = await proxy.makeRequest(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        fetchUserData: true,
        isCivil: false
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response:', errorText);
      return NextResponse.json(
        { error: `Failed to fetch user data: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Success response:', JSON.stringify(data).substring(0, 200));
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Exception in user-data route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

