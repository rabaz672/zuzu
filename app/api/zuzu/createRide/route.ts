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
    const url = 'https://zuzu.prat.idf.il/api/rides/createRide';
    
    const authUuid = body.authUuid || crypto.randomUUID();
    const operationId = body.operationId || crypto.randomUUID().replace(/-/g, '');
    const requestId = `|${operationId}.${crypto.randomUUID().replace(/-/g, '')}`;
    const traceparent = `00-${operationId}-${crypto.randomUUID().replace(/-/g, '')}-01`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${body.token}`,
      'Referer': body.referer || 'https://zuzu.prat.idf.il/dest',
      'Origin': 'https://zuzu.prat.idf.il',
      'auth-uuid': authUuid,
      'operation-Id': operationId,
      'Request-Id': requestId,
      'Request-Context': 'appId=cid-v1:b04aae2b-ea7c-4afb-80fa-0e2e76085085',
      'traceparent': traceparent,
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json'
    };

    if (body.cookies) {
      headers['Cookie'] = body.cookies;
    }

    const rideData = {
      replyId: body.replyId,
      JourneyAccessPointNumber: body.JourneyAccessPointNumber,
      PassengersNumber: body.PassengersNumber || 1,
      srcGPS: body.srcGPS,
      address: body.address,
      rideType: body.rideType || 1,
      codeOperator: body.codeOperator || '003',
      boardingPoint: body.boardingPoint || '',
      inOrOutTrain: body.inOrOutTrain || '',
      destination: body.destination,
      relatedRideId: body.relatedRideId || ''
    };

    const response = await proxy.makeRequest(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(rideData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Failed to create ride: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Exception in createRide route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

