class IDFProxy {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string = "https://my.idf.il") {
    this.baseUrl = baseUrl;
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

  async getUserInfo(idNumber: string): Promise<any> {
    const url = `${this.baseUrl}/api/users/`;
    const payload = { idNumber };
    const headers = this.mergeHeaders();

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async validateCode(idNumber: string, code: string, cookies?: string): Promise<any> {
    const url = `${this.baseUrl}/api/users/${idNumber}/validateCode`;
    const payload = { code };
    const headers = this.mergeHeaders();

    if (cookies) {
      headers['Cookie'] = cookies;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }
}

export default IDFProxy;

