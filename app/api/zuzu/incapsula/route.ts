import { NextRequest, NextResponse } from 'next/server';
import IDFProxy from '@/services/IDFProxy';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const swjiylwa = searchParams.get('SWJIYLWA') || '719d34d31c8e3a6e6fffd425f7e032f3';
    const ns = searchParams.get('ns') || '1';
    const cb = searchParams.get('cb') || Date.now().toString();
    const cookies = searchParams.get('cookies') || '';

    const proxy = new IDFProxy();
    const url = `https://zuzu.prat.idf.il/_Incapsula_Resource?SWJIYLWA=${swjiylwa}&ns=${ns}&cb=${cb}`;

    const headers: Record<string, string> = {
      'accept': '*/*',
      'accept-language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
      'priority': 'i',
      'referer': 'https://zuzu.prat.idf.il/home',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'no-cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
    };

    if (cookies) {
      headers['Cookie'] = cookies;
    }

    const response = await proxy.makeRequest(url, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Failed to call Incapsula: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.text();
    
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Exception in incapsula route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

