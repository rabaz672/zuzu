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

    console.log('=== USER DATA REQUEST ===');
    console.log('URL:', url);
    console.log('Token length:', body.token.length);
    console.log('Token (first 100 chars):', body.token.substring(0, 100));
    console.log('Token (last 100 chars):', body.token.substring(body.token.length - 100));
    console.log('Full token:', body.token);
    console.log('Headers:', JSON.stringify(headers, null, 2));
    console.log('Request body:', JSON.stringify({ fetchUserData: true, isCivil: false }));

    const response = await proxy.makeRequest(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        fetchUserData: true,
        isCivil: false
      })
    });

    console.log('=== RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Status text:', response.statusText);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('Response body:', responseText);

    if (!response.ok) {
      console.log('=== ERROR ===');
      console.log('Status:', response.status);
      console.log('Error response:', responseText);
      return NextResponse.json(
        { error: `Failed to fetch user data: ${response.status} - ${responseText}` },
        { status: response.status }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('Success response (first 500 chars):', JSON.stringify(data).substring(0, 500));
    } catch (e) {
      console.log('Failed to parse response as JSON');
      return NextResponse.json(
        { error: 'Invalid JSON response' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Exception in user-data route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

