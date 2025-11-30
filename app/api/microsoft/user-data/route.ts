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

    const response = await proxy.makeRequest(url, {
      method: 'POST',
      headers: headers,
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
    console.error('Exception in user-data route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

