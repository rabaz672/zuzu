const cookieStore = new Map<string, string>();

class IDFProxy {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private proxyUrl: string | undefined;

  constructor(baseUrl: string = "https://my.idf.il", proxyUrl?: string) {
    this.baseUrl = baseUrl;
    this.proxyUrl = proxyUrl || process.env.PROXY_URL;
    if (this.proxyUrl) {
      console.log('Proxy configured:', this.proxyUrl);
    } else {
      console.log('No proxy configured - using direct requests (server should be in Israel)');
    }
    this.defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Referer': 'https://my.idf.il/',
      'origin': 'https://my.idf.il'
    };
  }

  private mergeHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    return { ...this.defaultHeaders, ...customHeaders };
  }

  private extractCookies(response: Response): string {
    const cookies: string[] = [];
    const setCookieHeaders = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    
    if (setCookieHeaders.length > 0) {
      for (const cookieString of setCookieHeaders) {
        const parts = cookieString.split(';');
        if (parts.length > 0) {
          cookies.push(parts[0].trim());
        }
      }
    } else {
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        const cookieStrings = setCookieHeader.includes(',') 
          ? setCookieHeader.split(',') 
          : [setCookieHeader];
        for (const cookieString of cookieStrings) {
          const parts = cookieString.split(';');
          if (parts.length > 0) {
            cookies.push(parts[0].trim());
          }
        }
      }
    }
    
    return cookies.join('; ');
  }

  private async makeRequest(url: string, options: RequestInit): Promise<Response> {
    if (this.proxyUrl) {
      try {
        console.log('Using proxy:', this.proxyUrl, 'for URL:', url);
        
        const proxyUrlLower = this.proxyUrl.toLowerCase();
        let proxyAgent: any;
        
        if (proxyUrlLower.startsWith('socks5://') || proxyUrlLower.startsWith('socks4://')) {
          const { SocksProxyAgent } = await import('socks-proxy-agent');
          proxyAgent = new SocksProxyAgent(this.proxyUrl);
        } else {
          const { ProxyAgent } = await import('undici');
          proxyAgent = new ProxyAgent(this.proxyUrl);
        }
        
        const { fetch: undiciFetch } = await import('undici');
        
        const fetchOptions: any = {
          ...options,
          dispatcher: proxyAgent
        };
        
        console.log('Making proxy request with options:', JSON.stringify(fetchOptions, null, 2));
        const response = await undiciFetch(url, fetchOptions);
        console.log('Proxy request successful, status:', response.status);
        
        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(response.headers)) {
          if (Array.isArray(value)) {
            value.forEach(v => responseHeaders.append(key, v));
          } else {
            responseHeaders.set(key, value);
          }
        }
        
        const body = await response.arrayBuffer();
        const clonedResponse = new Response(body, {
          status: response.status,
          statusText: response.statusText || '',
          headers: responseHeaders
        });
        
        return clonedResponse;
      } catch (error: any) {
        console.error('Proxy error:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Falling back to direct request');
        return fetch(url, options);
      }
    }
    console.log('No proxy configured, using direct request to:', url);
    return fetch(url, options);
  }

  async getUserInfo(idNumber: string): Promise<{ data: any; cookies: string }> {
    const url = `${this.baseUrl}/api/users/`;
    const payload = { idNumber };
    const headers = this.mergeHeaders();

    const response = await this.makeRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('IDF API error:', response.status, errorText);
      
      if (response.status === 504 || response.status === 502) {
        throw new Error(`Proxy/Server timeout error (${response.status}). The proxy may be down or slow. Try again or use a different proxy.`);
      }
      
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText.substring(0, 200)}`);
    }

    const cookies = this.extractCookies(response);
    
    if (cookies) {
      cookieStore.set(idNumber, cookies);
    }

    const data = await response.json();
    return { data, cookies };
  }

  async validateId(idNumber: string): Promise<{ isValid: boolean; mobilePhone?: string; error?: string }> {
    try {
      const { data } = await this.getUserInfo(idNumber);
      
      if (data.mobilePhone && data.mobilePhone !== 'XXX-XXXX-X72') {
        return { isValid: true, mobilePhone: data.mobilePhone };
      }
      
      if (data.errorInZika === true) {
        return { isValid: false, error: 'User not valid' };
      }
      
      if (data.mobilePhone) {
        return { isValid: true, mobilePhone: data.mobilePhone };
      }
      
      return { isValid: false, error: 'Invalid response' };
    } catch (error: any) {
      if (error.message.includes('403')) {
        return { isValid: false, error: 'Geo-restriction: Access limited to certain geographical areas' };
      }
      return { isValid: false, error: error.message || 'Unknown error' };
    }
  }

  async validateCode(idNumber: string, code: string, cookies?: string): Promise<any> {
    const url = `${this.baseUrl}/api/users/${idNumber}/validateCode`;
    const payload = { code };
    const headers = this.mergeHeaders();

    const storedCookies = cookieStore.get(idNumber);
    const finalCookies = cookies || storedCookies || '';

    if (finalCookies) {
      headers['Cookie'] = finalCookies;
    }

    const response = await this.makeRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    return await response.json();
  }
}

export default IDFProxy;

