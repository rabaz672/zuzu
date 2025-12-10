import { NextRequest, NextResponse } from 'next/server';
import IDFProxy from '@/services/IDFProxy';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const singleLine = searchParams.get('SingleLine');
    const countryCode = searchParams.get('countryCode') || 'IL';
    const maxLocations = searchParams.get('maxLocations') || '6';

    if (!singleLine) {
      return NextResponse.json(
        { error: 'SingleLine parameter is required' },
        { status: 400 }
      );
    }

    const proxy = new IDFProxy();
    const outSR = JSON.stringify({ wkid: 4326 });
    const url = `https://utility.arcgis.com/usrsvcs/appservices/fYKob13hWOFIxwNL/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(singleLine)}&countryCode=${countryCode}&maxLocations=${maxLocations}&outSR=${encodeURIComponent(outSR)}&f=json`;

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
      'Referer': 'https://zuzu.prat.idf.il/'
    };

    const response = await proxy.makeRequest(url, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Failed to geocode: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Exception in geocode route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

