'use client';

import { useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

const MICROSOFT_CONFIG = {
  tenantId: '78820852-55fa-450b-908d-45c0d911e76b',
  clientId: '2d82cc91-ca5a-45bb-9a8d-4d33c6cb7cc5',
  redirectUri: 'https://www.home.idf.il/',
  scope: 'User.Read openid profile offline_access',
  authorizationEndpoint: 'https://login.microsoftonline.com/78820852-55fa-450b-908d-45c0d911e76b/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/78820852-55fa-450b-908d-45c0d911e76b/oauth2/v2.0/token'
};

export default function MicrosoftAuth() {
  const [idNumber, setIdNumber] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [tokens, setTokens] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [fetchingUserData, setFetchingUserData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [zuzuRide, setZuzuRide] = useState<any>(null);
  const [creatingRide, setCreatingRide] = useState(false);
  const [journeyAccessPoint, setJourneyAccessPoint] = useState<any>(null);
  const [fetchingAccessPoint, setFetchingAccessPoint] = useState(false);
  const [currentTryingNumber, setCurrentTryingNumber] = useState<string>('');
  // יעד קבוע - ניתן לשנות כאן
  const [fixedDestination] = useState({
    name: 'פיקוד העורף',
    lat: 31.92101,
    lon: 34.876663
  });
  const [activeTab, setActiveTab] = useState<'create' | 'access'>('create');
  const [zuzuCookies, setZuzuCookies] = useState('incap_ses_253_2822305=wBpreGMaVl04Vy8Jm9aCAxlaOWkAAAAAiAlbEISZnK1hjd6wadzCfQ%3D%3D; nlbi_2822305=RWMFJqPvxSyS7XMcJBgSsAAAAADC9DsvCu29c5WJMGhZBqDy; visid_incap_2822305=qqJBPEbOSSaskgB8LtKCFy1CNWkAAAAAQUIPAAAAAAChAggeVnzsb%2BrXgRJwWMBC');
  const [basePrefix, setBasePrefix] = useState('0.109800250350');
  const [centerSuffix, setCenterSuffix] = useState(223);
  const [delta, setDelta] = useState(100);
  const [generatedNumbers, setGeneratedNumbers] = useState<string[]>([]);
  const [busId, setBusId] = useState(''); // מזהה אוטובוס (ברקוד)
  const [replyId, setReplyId] = useState<string | null>(null); // REPLYID מהתשובה
  const [rideForm, setRideForm] = useState({
    JourneyAccessPointNumber: '',
    PassengersNumber: 1,
    srcLat: '',
    srcLon: '',
    destLat: fixedDestination.lat.toString(),
    destLon: fixedDestination.lon.toString(),
    address: '',
    rideType: 1,
    codeOperator: '003',
    StationNumber: 0
  });

  const generateCodeVerifier = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const generateCodeChallenge = async (verifier: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const generateMicrosoftAuthUrl = async (idNumber: string) => {
    const upn = `${idNumber}@idf.il`;
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    sessionStorage.setItem('code_verifier', codeVerifier);
    
    const params = new URLSearchParams({
      client_id: MICROSOFT_CONFIG.clientId,
      scope: MICROSOFT_CONFIG.scope,
      redirect_uri: MICROSOFT_CONFIG.redirectUri,
      response_mode: 'fragment',
      response_type: 'code',
      login_hint: upn,
      'X-AnchorMailbox': `UPN:${upn}`,
      nonce: crypto.randomUUID(),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: btoa(JSON.stringify({ id: crypto.randomUUID(), meta: { interactionType: 'popup' } }))
    });

    return `${MICROSOFT_CONFIG.authorizationEndpoint}?${params.toString()}`;
  };

  const extractCodeFromUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      const hash = urlObj.hash.substring(1);
      const params = new URLSearchParams(hash);
      
      const authCode = params.get('code');
      const authState = params.get('state');
      const authError = params.get('error');
      const errorDescription = params.get('error_description');

      if (authError) {
        setError(`${authError}: ${errorDescription || ''}`);
        return false;
      } else if (authCode) {
        setCode(authCode);
        setState(authState);
        
        const codeData = {
          code: authCode,
          state: authState,
          timestamp: new Date().toISOString(),
          url: url
        };
        
        localStorage.setItem('microsoft_auth_code', JSON.stringify(codeData));
        setSaved(true);
        setError(null);
        
        handleExchangeCodeForTokens(authCode);
        return true;
      }
      return false;
    } catch (err) {
      setError('URL לא תקין');
      return false;
    }
  };

  const handleConnect = async () => {
    if (!idNumber.trim()) {
      setError('מספר ת.ז. נדרש');
      return;
    }

    setLoading(true);
    setError(null);
    setCode(null);
    setState(null);
    setSaved(false);

    try {
      const authUrl = await generateMicrosoftAuthUrl(idNumber.trim());
      window.open(authUrl, '_blank', 'width=600,height=700');
    } catch (err: any) {
      setError('שגיאה ביצירת קישור אימות: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractCode = () => {
    if (!urlInput.trim()) {
      setError('יש להדביק URL');
      return;
    }
    extractCodeFromUrl(urlInput.trim());
    setUrlInput('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('הועתק ללוח!');
    });
  };


  const handleExchangeCodeForTokens = async (authCode: string) => {
    setExchanging(true);
    setError(null);

    try {
      const codeVerifier = sessionStorage.getItem('code_verifier');
      if (!codeVerifier) {
        throw new Error('Code verifier לא נמצא. נסה שוב מההתחלה.');
      }

      const params = new URLSearchParams({
        client_id: MICROSOFT_CONFIG.clientId,
        scope: MICROSOFT_CONFIG.scope,
        code: authCode,
        redirect_uri: MICROSOFT_CONFIG.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
        client_info: '1'
      });

      const response = await fetch(MICROSOFT_CONFIG.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': '*/*'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`שגיאה בהחלפת קוד: ${response.status} - ${errorText}`);
      }

      const tokenData = await response.json();
      setTokens(tokenData);
      
      const fullData = {
        code: authCode,
        state: state,
        tokens: tokenData,
        timestamp: new Date().toISOString(),
        idNumber: idNumber
      };
      
      localStorage.setItem('microsoft_auth_tokens', JSON.stringify(fullData));
      
      if (tokenData.id_token) {
        await handleFetchUserData(tokenData.id_token);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExchanging(false);
    }
  };

  const decodeJWT = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };

  const handleFetchUserData = async (idToken: string) => {
    setFetchingUserData(true);
    setError(null);

    try {
      const savedTokens = JSON.parse(localStorage.getItem('microsoft_auth_tokens') || '{}');
      const tokens = savedTokens.tokens || {};
      
      if (!tokens.id_token) {
        throw new Error('לא נמצא id_token');
      }

      const idTokenData = decodeJWT(tokens.id_token);
      if (idTokenData) {
        const exp = idTokenData.exp * 1000;
        const now = Date.now();
        if (exp <= now) {
          throw new Error('id_token פג תוקף');
        }
      }

      const response = await fetch('/api/microsoft/user-data', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          token: tokens.id_token
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`שגיאה בקבלת נתוני משתמש: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const data = await response.json();
      setUserData(data);
      
      const fullData = {
        ...savedTokens,
        userData: data,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem('microsoft_auth_complete', JSON.stringify(fullData));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFetchingUserData(false);
    }
  };

  const downloadCode = () => {
    const data = tokens ? {
      code: code,
      state: state,
      tokens: tokens,
      timestamp: new Date().toISOString(),
      idNumber: idNumber
    } : {
      code: code,
      state: state,
      timestamp: new Date().toISOString(),
      idNumber: idNumber
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `microsoft-auth-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '2rem', 
      backgroundColor: '#f5f5f5',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ 
        maxWidth: '600px', 
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <Link 
            href="/"
            style={{
              color: '#0070f3',
              textDecoration: 'none',
              fontSize: '0.9rem'
            }}
          >
            ← חזרה לדף הבית
          </Link>
        </div>

        <h1 style={{ 
          fontSize: '2rem', 
          marginBottom: '2rem',
          color: '#333',
          textAlign: 'center'
        }}>
          אימות Microsoft עם כניסה פיזית
        </h1>

        <div style={{
          marginBottom: '2rem',
          padding: '1rem',
          backgroundColor: '#f0f9ff',
          borderRadius: '6px',
          border: '1px solid #bae6fd'
        }}>
          <p style={{ margin: 0, color: '#0369a1', fontSize: '0.9rem' }}>
            הכנס את מספר ת.ז. שלך כדי להתחבר ל-Microsoft
          </p>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem',
            fontWeight: '600',
            color: '#555'
          }}>
            מספר ת.ז.
          </label>
          <input
            type="text"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleConnect();
              }
            }}
            placeholder="הכנס מספר ת.ז."
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              border: '1px solid #ddd',
              borderRadius: '6px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <button
          onClick={handleConnect}
          disabled={loading || !idNumber.trim()}
          style={{
            width: '100%',
            padding: '1rem 1.5rem',
            fontSize: '1.1rem',
            backgroundColor: '#0078d4',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading || !idNumber.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !idNumber.trim() ? 0.6 : 1,
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
        >
          <span>🔐</span>
          <span>התחבר ל-Microsoft</span>
        </button>

        {idNumber.trim() && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            fontSize: '0.85rem',
            color: '#6b7280',
            textAlign: 'center'
          }}>
            UPN: <strong>{idNumber.trim()}@idf.il</strong>
          </div>
        )}

        {!code && (
          <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            backgroundColor: '#f0f9ff',
            borderRadius: '6px',
            border: '1px solid #bae6fd'
          }}>
            <h2 style={{
              fontSize: '1.2rem',
              fontWeight: '600',
              color: '#0369a1',
              marginBottom: '1rem'
            }}>
              אחרי ההתחברות ל-Microsoft:
            </h2>
            <p style={{
              marginBottom: '1rem',
              color: '#0369a1',
              fontSize: '0.9rem'
            }}>
              תועבר ל-<code style={{ backgroundColor: '#e0f2fe', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>https://www.prat.idf.il/</code> עם הקוד ב-URL.
              <br />
              העתק את כל ה-URL מהשורת הכתובת והדבק כאן:
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleExtractCode();
                  }
                }}
                placeholder="הדבק כאן את ה-URL שקיבלת אחרי ההתחברות"
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                onClick={handleExtractCode}
                disabled={!urlInput.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: urlInput.trim() ? 'pointer' : 'not-allowed',
                  opacity: urlInput.trim() ? 1 : 0.6,
                  fontWeight: '600',
                  whiteSpace: 'nowrap'
                }}
              >
                חלץ קוד
              </button>
            </div>
          </div>
        )}

        {code && (
          <>
            {saved && (
              <div style={{
                marginTop: '2rem',
                padding: '1rem',
                backgroundColor: '#f0fdf4',
                borderRadius: '6px',
                border: '1px solid #10b981',
                textAlign: 'center',
                color: '#166534',
                fontWeight: '600'
              }}>
                ✓ הקוד נשמר ב-localStorage
              </div>
            )}

            <div style={{
              marginTop: '2rem',
              padding: '1.5rem',
              backgroundColor: '#f0fdf4',
              borderRadius: '6px',
              border: '2px solid #10b981'
            }}>
              <div style={{
                fontSize: '1.2rem',
                fontWeight: '700',
                color: '#10b981',
                marginBottom: '1rem',
                textAlign: 'center'
              }}>
                ✓ Authorization Code התקבל בהצלחה!
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#555'
                }}>
                  Authorization Code:
                </label>
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginBottom: '0.5rem'
                }}>
                  <textarea
                    readOnly
                    value={code}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      fontSize: '0.9rem',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      resize: 'vertical',
                      minHeight: '100px'
                    }}
                  />
                  <button
                    onClick={() => copyToClipboard(code)}
                    style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: '#0070f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    העתק
                  </button>
                </div>
              </div>

              {state && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem',
                    fontWeight: '600',
                    color: '#555'
                  }}>
                    State:
                  </label>
                  <div style={{
                    padding: '0.75rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all'
                  }}>
                    {state}
                  </div>
                </div>
              )}

              <div style={{
                display: 'flex',
                gap: '1rem',
                marginTop: '1.5rem'
              }}>
                <button
                  onClick={downloadCode}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1.5rem',
                    fontSize: '1rem',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  הורד כקובץ JSON
                </button>
                <button
                  onClick={() => {
                    setCode(null);
                    setState(null);
                    setTokens(null);
                    setUrlInput('');
                    setSaved(false);
                  }}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1.5rem',
                    fontSize: '1rem',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  התחלה מחדש
                </button>
              </div>
            </div>
          </>
        )}

        {tokens && (
          <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            backgroundColor: '#f0fdf4',
            borderRadius: '6px',
            border: '2px solid #10b981'
          }}>
            <div style={{
              fontSize: '1.2rem',
              fontWeight: '700',
              color: '#10b981',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              ✓ Tokens התקבלו בהצלחה!
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#555'
              }}>
                Access Token:
              </label>
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '0.5rem'
              }}>
                <textarea
                  readOnly
                  value={tokens.access_token}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    fontSize: '0.85rem',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    resize: 'vertical',
                    minHeight: '80px'
                  }}
                />
                <button
                  onClick={() => copyToClipboard(tokens.access_token)}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    whiteSpace: 'nowrap'
                  }}
                >
                  העתק
                </button>
              </div>
            </div>

            {tokens.refresh_token && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#555'
                }}>
                  Refresh Token:
                </label>
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginBottom: '0.5rem'
                }}>
                  <textarea
                    readOnly
                    value={tokens.refresh_token}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      fontSize: '0.85rem',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      resize: 'vertical',
                      minHeight: '80px'
                    }}
                  />
                  <button
                    onClick={() => copyToClipboard(tokens.refresh_token)}
                    style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: '#0070f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    העתק
                  </button>
                </div>
              </div>
            )}

            {tokens.id_token && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#555'
                }}>
                  ID Token:
                </label>
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginBottom: '0.5rem'
                }}>
                  <textarea
                    readOnly
                    value={tokens.id_token}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      fontSize: '0.85rem',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      resize: 'vertical',
                      minHeight: '80px'
                    }}
                  />
                  <button
                    onClick={() => copyToClipboard(tokens.id_token)}
                    style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: '#0070f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    העתק
                  </button>
                </div>
              </div>
            )}

            <div style={{
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '6px',
              marginTop: '1rem',
              fontSize: '0.9rem'
            }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Expires In:</strong> {tokens.expires_in} שניות
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Token Type:</strong> {tokens.token_type}
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>Scope:</strong> {tokens.scope}
              </div>
            </div>
          </div>
        )}

        {fetchingUserData && (
          <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            backgroundColor: '#fef3c7',
            borderRadius: '6px',
            border: '1px solid #fbbf24',
            textAlign: 'center',
            color: '#92400e',
            fontWeight: '600'
          }}>
            ⏳ מביא נתוני משתמש...
          </div>
        )}

        {userData && (
          <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            backgroundColor: '#f0fdf4',
            borderRadius: '6px',
            border: '2px solid #10b981'
          }}>
            <div style={{
              fontSize: '1.2rem',
              fontWeight: '700',
              color: '#10b981',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              ✓ נתוני משתמש התקבלו בהצלחה!
            </div>

            {userData.userData && (
              <div style={{
                padding: '1rem',
                backgroundColor: 'white',
                borderRadius: '6px',
                marginBottom: '1rem'
              }}>
                <h3 style={{
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: '#333',
                  marginBottom: '1rem'
                }}>
                  פרטי משתמש:
                </h3>
                <div style={{
                  display: 'grid',
                  gap: '0.75rem',
                  fontSize: '0.95rem'
                }}>
                  <div>
                    <strong>ת.ז.:</strong> {userData.userData.personalId}
                  </div>
                  <div>
                    <strong>שם פרטי:</strong> {userData.userData.firstName}
                  </div>
                  <div>
                    <strong>שם משפחה:</strong> {userData.userData.lastName}
                  </div>
                  {userData.userData.email && (
                    <div>
                      <strong>אימייל:</strong> {userData.userData.email}
                    </div>
                  )}
                  <div>
                    <strong>סוג שירות:</strong> {userData.userData.serviceType}
                  </div>
                  <div>
                    <strong>Analytics ID:</strong> {userData.userData.analyticsId}
                  </div>
                  {userData.userData.roles && userData.userData.roles.length > 0 && (
                    <div>
                      <strong>תפקידים:</strong> {userData.userData.roles.join(', ')}
                    </div>
                  )}
                  {userData.userData.favorites && userData.userData.favorites.length > 0 && (
                    <div>
                      <strong>מועדפים:</strong> {userData.userData.favorites.length} פריטים
                    </div>
                  )}
                  {userData.userData.searchHistory && userData.userData.searchHistory.length > 0 && (
                    <div>
                      <strong>היסטוריית חיפוש:</strong>
                      <ul style={{ marginTop: '0.5rem', paddingRight: '1.5rem' }}>
                        {userData.userData.searchHistory.map((item: string, index: number) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '6px',
              marginTop: '1rem'
            }}>
              <button
                onClick={() => copyToClipboard(JSON.stringify(userData, null, 2))}
                style={{
                  width: '100%',
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                העתק נתוני משתמש
              </button>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#fef2f2',
            borderRadius: '6px',
            border: '1px solid #fecaca',
            color: '#991b1b',
            marginTop: '1rem'
          }}>
            <strong>שגיאה:</strong> {error}
          </div>
        )}

        {tokens && (tokens.id_token || tokens.access_token) && (
          <div style={{
            marginTop: '2rem',
            padding: '1.5rem',
            backgroundColor: '#f0f9ff',
            borderRadius: '6px',
            border: '2px solid #0ea5e9'
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#0ea5e9',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>
              🚗 ניהול נסיעות ZUZU
            </h2>

            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1.5rem',
              borderBottom: '2px solid #e0e7ff'
            }}>
              <button
                onClick={() => setActiveTab('create')}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  backgroundColor: activeTab === 'create' ? '#0ea5e9' : 'transparent',
                  color: activeTab === 'create' ? 'white' : '#0ea5e9',
                  border: 'none',
                  borderBottom: activeTab === 'create' ? '3px solid #0ea5e9' : '3px solid transparent',
                  cursor: 'pointer',
                  borderRadius: '6px 6px 0 0',
                  transition: 'all 0.2s'
                }}
              >
                יצירת נסיעה
              </button>
              <button
                onClick={() => setActiveTab('access')}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  backgroundColor: activeTab === 'access' ? '#0ea5e9' : 'transparent',
                  color: activeTab === 'access' ? 'white' : '#0ea5e9',
                  border: 'none',
                  borderBottom: activeTab === 'access' ? '3px solid #0ea5e9' : '3px solid transparent',
                  cursor: 'pointer',
                  borderRadius: '6px 6px 0 0',
                  transition: 'all 0.2s'
                }}
              >
                נקודת גישה
              </button>
      </div>

            {activeTab === 'create' && (
              <>
                <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#e0f2fe', borderRadius: '6px', border: '2px solid #0ea5e9' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.75rem',
                    fontWeight: '600',
                    color: '#0ea5e9',
                    fontSize: '1.2rem'
                  }}>
                    📱 שלב 1: סריקת ברקוד אוטובוס (מזהה אוטובוס)
                  </label>
                  <input
                    type="text"
                    value={busId}
                    onChange={(e) => {
                      setBusId(e.target.value);
                      setRideForm({...rideForm, JourneyAccessPointNumber: e.target.value});
                    }}
                    placeholder="00001322501003"
                    style={{
                      width: '100%',
                      padding: '1rem',
                      fontSize: '1.2rem',
                      border: '2px solid #0ea5e9',
                      borderRadius: '6px',
                      boxSizing: 'border-box',
                      fontFamily: 'monospace',
                      textAlign: 'center',
                      fontWeight: '600'
                    }}
                  />
                  <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem', textAlign: 'center' }}>
                    סרוק את הברקוד מהאוטובוס או הזן ידנית
    </div>
                </div>

                {!busId && (
                <div style={{ 
                  marginBottom: '1.5rem', 
                  padding: '1.5rem', 
                  backgroundColor: '#fff7ed', 
                  borderRadius: '12px', 
                  border: '2px solid #f97316',
                  boxShadow: '0 2px 8px rgba(249, 115, 22, 0.1)'
                }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '1rem',
                    fontWeight: '700',
                    color: '#f97316',
                    fontSize: '1.2rem'
                  }}>
                    🔢 יצירת מספרי נקודת גישה (אופציונלי)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: '0.5rem',
                        fontSize: '0.9rem',
                        color: '#666',
                        fontWeight: '600'
                      }}>
                        Base Prefix:
                      </label>
                      <input
                        type="text"
                        value={basePrefix}
                        onChange={(e) => setBasePrefix(e.target.value)}
                        placeholder="0.109800250350"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          fontSize: '1rem',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: '0.5rem',
                        fontSize: '0.9rem',
                        color: '#666',
                        fontWeight: '600'
                      }}>
                        Center Suffix:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="999"
                        value={centerSuffix}
                        onChange={(e) => setCenterSuffix(parseInt(e.target.value) || 0)}
                        placeholder="223"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          fontSize: '1rem',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: '0.5rem',
                        fontSize: '0.9rem',
                        color: '#666',
                        fontWeight: '600'
                      }}>
                        Delta:
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={delta}
                        onChange={(e) => setDelta(parseInt(e.target.value) || 0)}
                        placeholder="100"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          fontSize: '1rem',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const numbers: string[] = [];
                      const start = centerSuffix - delta;
                      const end = centerSuffix + delta;
                      
                      for (let i = start; i <= end; i++) {
                        if (i >= 0 && i <= 999) {
                          const numStr = `${basePrefix}${i.toString().padStart(3, '0')}`;
                          numbers.push(numStr);
                        }
                      }
                      setGeneratedNumbers(numbers);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1.5rem',
                      fontSize: '1rem',
                      backgroundColor: '#f97316',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      marginBottom: '0.75rem'
                    }}
                  >
                    🔢 צור מספרים
                  </button>
                  {generatedNumbers.length > 0 && (
                    <div style={{
                      maxHeight: '200px',
                      overflowY: 'auto',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      backgroundColor: 'white',
                      padding: '0.75rem',
                      fontSize: '0.9rem',
                      fontFamily: 'monospace'
                    }}>
                      {generatedNumbers.map((num, index) => (
                        <div key={index} style={{ padding: '0.25rem 0' }}>
                          {num}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}

                <div style={{ 
                  marginBottom: '1.5rem', 
                  padding: '1.5rem', 
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0'
                }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '1rem',
                    fontWeight: '700',
                    color: '#1e293b',
                    fontSize: '1.1rem'
                  }}>
                    👤 פרטי נסיעה
                  </label>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: '0.5rem',
                        fontSize: '0.9rem',
                        color: '#64748b',
                        fontWeight: '600'
                      }}>
                        מספר נוסעים:
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={rideForm.PassengersNumber}
                        onChange={(e) => setRideForm({...rideForm, PassengersNumber: parseInt(e.target.value) || 1})}
                        style={{
                          width: '100%',
                          padding: '0.875rem',
                          fontSize: '1rem',
                          border: '2px solid #e2e8f0',
                          borderRadius: '8px',
                          boxSizing: 'border-box',
                          transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#0ea5e9'}
                        onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                      />
                    </div>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: '0.5rem',
                        fontSize: '0.9rem',
                        color: '#64748b',
                        fontWeight: '600'
                      }}>
                        מיקום נוכחי (GPS):
                      </label>
                      <button
                        onClick={() => {
                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              (position) => {
                                setRideForm({
                                  ...rideForm,
                                  srcLat: position.coords.latitude.toString(),
                                  srcLon: position.coords.longitude.toString()
                                });
                              },
                              (error) => {
                                setError('לא ניתן לקבל מיקום: ' + error.message);
                              }
                            );
                          } else {
                            setError('הדפדפן לא תומך ב-GPS');
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '0.875rem',
                          fontSize: '1rem',
                          backgroundColor: '#0ea5e9',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0284c7'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0ea5e9'}
                      >
                        📍 קבל מיקום נוכחי
                      </button>
                    </div>
                  </div>
                  
                  {(rideForm.srcLat && rideForm.srcLon) && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '0.75rem',
                      backgroundColor: '#f0f9ff',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      color: '#0369a1'
                    }}>
                      <strong>מיקום נוכחי:</strong> {rideForm.srcLat}, {rideForm.srcLon}
                    </div>
                  )}
                </div>


                <button
                  onClick={async () => {
                    if (!rideForm.JourneyAccessPointNumber && !busId) {
                      setError('יש לסרוק ברקוד אוטובוס או להזין מזהה אוטובוס');
                      return;
                    }

                    if (!rideForm.srcLat || !rideForm.srcLon) {
                      setError('יש לקבל מיקום נוכחי (לחץ על "קבל מיקום נוכחי")');
                      return;
                    }

                    // אם יש busId, השתמש בו. אחרת נסה מספרים
                    if (busId && !generatedNumbers.length) {
                      // יש busId, לא צריך ליצור מספרים
                    } else if (!busId && generatedNumbers.length === 0) {
                      setError('יש ליצור מספרים קודם (לחץ על "צור מספרים") או לסרוק ברקוד אוטובוס');
                      return;
                    }

                    setCreatingRide(true);
                    setError(null);

                    try {
                      const token = tokens.id_token || tokens.access_token;
                      
                      if (!token) {
                        throw new Error('לא נמצא token. יש להתחבר מחדש.');
                      }

                      const tokenData = decodeJWT(token);
                      if (tokenData) {
                        const exp = tokenData.exp * 1000;
                        const now = Date.now();
                        if (exp <= now) {
                          throw new Error('Token פג תוקף. יש להתחבר מחדש.');
                        }
                        console.log('Token expires at:', new Date(exp).toISOString());
                        console.log('Token is valid for:', Math.floor((exp - now) / 1000), 'seconds');
                      }

                      console.log('Using token type:', tokens.id_token ? 'id_token' : 'access_token');
                      console.log('Token length:', token.length);
                      console.log('Token preview:', token.substring(0, 50) + '...');
                      
                      // נסה כל מספר עד שנמצא אחד שעובד
                      let foundAccessPoint = false;
                      let accessPointData = null;
                      let workingJourneyAccessPointNumber = busId || rideForm.JourneyAccessPointNumber;
                      let journeyReplyId = null;

                      // אם יש busId, נסה אותו ישירות
                      if (busId || rideForm.JourneyAccessPointNumber) {
                        try {
                          const directNumber = busId || rideForm.JourneyAccessPointNumber;
                          console.log(`מנסה מזהה אוטובוס ישירות: ${directNumber}`);
                          setCurrentTryingNumber(`בודק מזהה אוטובוס: ${directNumber}`);
                          
                          const accessPointResponse = await fetch('/api/zuzu/getJourneyAccessPoint', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                              token: token,
                              cookies: zuzuCookies || undefined,
                              JourneyAccessPointNumber: directNumber,
                              srcGPS: {
                                lat: parseFloat(rideForm.srcLat),
                                lon: parseFloat(rideForm.srcLon)
                              },
                              StationNumber: rideForm.StationNumber || 0
                            })
                          });

                          if (accessPointResponse.ok) {
                            accessPointData = await accessPointResponse.json();
                            workingJourneyAccessPointNumber = directNumber;
                            foundAccessPoint = true;
                            journeyReplyId = accessPointData?.replyId || accessPointData?.replyID;
                            console.log(`✓ מזהה אוטובוס תקף: ${directNumber}`);
                            console.log('REPLYID מהתשובה:', journeyReplyId);
                            setCurrentTryingNumber('');
                          } else {
                            let errorText = '';
                            try {
                              const errorData = await accessPointResponse.json();
                              errorText = errorData.error || errorData.message || `Status ${accessPointResponse.status}`;
                            } catch (e) {
                              errorText = `Status ${accessPointResponse.status}`;
                            }
                            console.log(`✗ מזהה אוטובוס לא תקף: ${errorText}`);
                          }
                        } catch (err: any) {
                          console.log(`✗ שגיאה עם מזהה אוטובוס:`, err?.message || err);
                        }
                      }

                      // אם לא נמצא עם busId, נסה מספרים
                      if (!foundAccessPoint) {
                        for (let i = 0; i < generatedNumbers.length; i++) {
                          const journeyNumber = generatedNumbers[i];
                          try {
                            setCurrentTryingNumber(`מנסה ${i + 1}/${generatedNumbers.length}: ${journeyNumber}`);
                            console.log(`מנסה מספר נקודת גישה: ${journeyNumber} (${i + 1}/${generatedNumbers.length})`);
                            
                            const accessPointResponse = await fetch('/api/zuzu/getJourneyAccessPoint', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({
                                token: token,
                                cookies: zuzuCookies || undefined,
                                JourneyAccessPointNumber: journeyNumber,
                                srcGPS: {
                                  lat: parseFloat(rideForm.srcLat),
                                  lon: parseFloat(rideForm.srcLon)
                                },
                                StationNumber: rideForm.StationNumber || 0
                              })
                            });

                            if (accessPointResponse.ok) {
                              accessPointData = await accessPointResponse.json();
                              workingJourneyAccessPointNumber = journeyNumber;
                              foundAccessPoint = true;
                              journeyReplyId = accessPointData?.replyId || accessPointData?.replyID;
                              console.log(`✓ נמצא מספר נקודת גישה עובד: ${journeyNumber}`);
                              console.log('REPLYID מהתשובה:', journeyReplyId);
                              break;
                            } else {
                              let errorText = '';
                              try {
                                const errorData = await accessPointResponse.json();
                                errorText = errorData.error || errorData.message || `Status ${accessPointResponse.status}`;
                              } catch (e) {
                                errorText = `Status ${accessPointResponse.status}`;
                              }
                              console.log(`✗ מספר ${journeyNumber} לא עבד: ${errorText}`);
                            }
                          } catch (err: any) {
                            console.log(`✗ שגיאה עם מספר ${journeyNumber}:`, err?.message || err);
                            continue;
                          }
                        }
                      }

                      setCurrentTryingNumber('');

                      if (!foundAccessPoint) {
                        throw new Error(`לא נמצא מספר נקודת גישה תקף מתוך ${generatedNumbers.length} מספרים שנוסו. נסה לשנות את הפרמטרים (Base Prefix, Center Suffix, Delta) או לבדוק את הקונסול לפרטים.`);
                      }

                      console.log('Journey Access Point:', accessPointData);
                      
                      // עדכן את הטופס עם המספר שנמצא
                      setRideForm({
                        ...rideForm,
                        JourneyAccessPointNumber: workingJourneyAccessPointNumber
                      });

                      // אם לא קיבלנו REPLYID, צור אחד חדש
                      if (!journeyReplyId) {
                        journeyReplyId = Array.from(crypto.getRandomValues(new Uint8Array(32)))
                          .map(b => b.toString(16).padStart(2, '0'))
                          .join('');
                        console.log('יצירת REPLYID חדש:', journeyReplyId);
                      }
                      
                      setReplyId(journeyReplyId);
                      console.log('Using REPLYID:', journeyReplyId);

                      const response = await fetch('/api/zuzu/createRide', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          token: token,
                          cookies: zuzuCookies || undefined,
                          replyId: journeyReplyId,
                          JourneyAccessPointNumber: workingJourneyAccessPointNumber,
                          PassengersNumber: rideForm.PassengersNumber,
                          srcGPS: {
                            lat: parseFloat(rideForm.srcLat),
                            lon: parseFloat(rideForm.srcLon)
                          },
                          address: rideForm.address || '3tqdbzp0rr75p3txuvermk3gsxaxj30zruug8jzjuf6jfkz',
                          rideType: rideForm.rideType,
                          codeOperator: rideForm.codeOperator,
                          boardingPoint: '',
                          inOrOutTrain: '',
                          destination: {
                            lon: parseFloat(rideForm.destLon),
                            lat: parseFloat(rideForm.destLat)
                          },
                          relatedRideId: ''
                        })
                      });

                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'שגיאה ביצירת נסיעה');
                      }

                      const data = await response.json();
                      setZuzuRide(data);
                      setError(null); // נקה שגיאות קודמות אם הצליח
                    } catch (err: any) {
                      console.error('שגיאה ביצירת נסיעה:', err);
                      setError(err?.message || 'שגיאה לא ידועה ביצירת נסיעה');
                    } finally {
                      setCreatingRide(false);
                    }
                  }}
                  disabled={creatingRide || (!busId && !rideForm.JourneyAccessPointNumber && generatedNumbers.length === 0) || !rideForm.srcLat || !rideForm.srcLon}
                  style={{
                    width: '100%',
                    padding: '1rem 1.5rem',
                    fontSize: '1.1rem',
                    backgroundColor: creatingRide ? '#94a3b8' : '#0ea5e9',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: creatingRide ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    marginTop: '1rem'
                  }}
                >
                  {creatingRide ? 'יוצר נסיעה...' : '🚗 צור נסיעה'}
                </button>

                {zuzuRide && (
                  <div style={{
                    marginTop: '1.5rem',
                    padding: '1.5rem',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '6px',
                    border: '2px solid #10b981'
                  }}>
                    <div style={{
                      fontSize: '1.2rem',
                      fontWeight: '700',
                      color: '#10b981',
                      marginBottom: '1rem',
                      textAlign: 'center'
                    }}>
                      ✓ נסיעה נוצרה בהצלחה!
                    </div>
                    {zuzuRide.journeyQr && (
                      <div style={{
                        padding: '1.5rem',
                        backgroundColor: 'white',
                        borderRadius: '6px',
                        marginBottom: '1rem',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '1rem', color: '#666', marginBottom: '1rem', fontWeight: '600' }}>
                          📱 ברקוד נסיעה:
                        </div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginBottom: '1rem',
                          padding: '1rem',
                          backgroundColor: '#f9fafb',
                          borderRadius: '8px'
                        }}>
                          <QRCodeSVG 
                            value={zuzuRide.journeyQr}
                            size={200}
                            level="H"
                            includeMargin={true}
                          />
                        </div>
                        <div style={{ 
                          fontSize: '0.9rem', 
                          color: '#666', 
                          marginTop: '0.5rem',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                          padding: '0.5rem',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '4px'
                        }}>
                          {zuzuRide.journeyQr}
                        </div>
                      </div>
                    )}
                    {zuzuRide.TimeLeftForActiveInMs && (
                      <div style={{
                        padding: '1rem',
                        backgroundColor: 'white',
                        borderRadius: '6px',
                        marginBottom: '1rem',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>זמן פעיל (מילישניות):</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>
                          {zuzuRide.TimeLeftForActiveInMs.toLocaleString()}
                        </div>
                      </div>
                    )}
                    <div style={{
                      padding: '1rem',
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      fontFamily: 'monospace',
                      overflow: 'auto',
                      maxHeight: '300px',
                      marginBottom: '1rem'
                    }}>
                      <pre>{JSON.stringify(zuzuRide, null, 2)}</pre>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(zuzuRide, null, 2))}
                        style={{
                          flex: 1,
                          padding: '0.75rem 1.5rem',
                          fontSize: '1rem',
                          backgroundColor: '#0070f3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        העתק תשובה
                      </button>
                      <button
                        onClick={() => {
                          setZuzuRide(null);
                          setRideForm({
                            JourneyAccessPointNumber: '',
                            PassengersNumber: 1,
                            srcLat: '',
                            srcLon: '',
                            destLat: '',
                            destLon: '',
                            address: '',
                            rideType: 1,
                            codeOperator: '003',
                            StationNumber: 0
                          });
                        }}
                        style={{
                          flex: 1,
                          padding: '0.75rem 1.5rem',
                          fontSize: '1rem',
                          backgroundColor: '#6b7280',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                      >
                        נקה טופס
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'access' && (
              <div>
                <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fff7ed', borderRadius: '6px', border: '1px solid #fed7aa' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.75rem',
                    fontWeight: '600',
                    color: '#555',
                    fontSize: '1.1rem'
                  }}>
                    🔢 יצירת מספרי נקודת גישה:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: '0.5rem',
                        fontSize: '0.9rem',
                        color: '#666',
                        fontWeight: '600'
                      }}>
                        Base Prefix:
                      </label>
                      <input
                        type="text"
                        value={basePrefix}
                        onChange={(e) => setBasePrefix(e.target.value)}
                        placeholder="0.109800250350"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          fontSize: '1rem',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: '0.5rem',
                        fontSize: '0.9rem',
                        color: '#666',
                        fontWeight: '600'
                      }}>
                        Center Suffix:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="999"
                        value={centerSuffix}
                        onChange={(e) => setCenterSuffix(parseInt(e.target.value) || 0)}
                        placeholder="223"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          fontSize: '1rem',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: '0.5rem',
                        fontSize: '0.9rem',
                        color: '#666',
                        fontWeight: '600'
                      }}>
                        Delta:
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={delta}
                        onChange={(e) => setDelta(parseInt(e.target.value) || 0)}
                        placeholder="100"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          fontSize: '1rem',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const numbers: string[] = [];
                      const start = centerSuffix - delta;
                      const end = centerSuffix + delta;
                      
                      for (let i = start; i <= end; i++) {
                        if (i >= 0 && i <= 999) {
                          const numStr = `${basePrefix}${i.toString().padStart(3, '0')}`;
                          numbers.push(numStr);
                        }
                      }
                      setGeneratedNumbers(numbers);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1.5rem',
                      fontSize: '1rem',
                      backgroundColor: '#f97316',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      marginBottom: '0.75rem'
                    }}
                  >
                    🔢 צור מספרים
                  </button>
                  {generatedNumbers.length > 0 && (
                    <div style={{
                      maxHeight: '200px',
                      overflowY: 'auto',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      backgroundColor: 'white',
                      padding: '0.75rem',
                      fontSize: '0.9rem',
                      fontFamily: 'monospace'
                    }}>
                      {generatedNumbers.map((num, index) => (
                        <div key={index} style={{ padding: '0.25rem 0' }}>
                          {num}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {rideForm.JourneyAccessPointNumber && (
                  <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #10b981' }}>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem',
                      fontWeight: '600',
                      color: '#10b981'
                    }}>
                      ✓ מספר נקודת גישה שנמצא:
                    </label>
                    <div style={{
                      padding: '0.75rem',
                      fontSize: '1.1rem',
                      fontFamily: 'monospace',
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      fontWeight: '600'
                    }}>
                      {rideForm.JourneyAccessPointNumber}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem',
                    fontWeight: '600',
                    color: '#555'
                  }}>
                    Cookies (אופציונלי):
                  </label>
                  <textarea
                    value={zuzuCookies}
                    onChange={(e) => setZuzuCookies(e.target.value)}
                    placeholder="incap_ses_253_2822305=...; nlbi_2822305=...; visid_incap_2822305=..."
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '0.9rem',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      boxSizing: 'border-box',
                      minHeight: '80px',
                      fontFamily: 'monospace',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
                    Cookies נטענו כברירת מחדל. ניתן לעדכן אם נדרש.
                  </div>
                </div>

                <div style={{ 
                  marginBottom: '1.5rem', 
                  padding: '1.5rem', 
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0'
                }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '1rem',
                    fontWeight: '700',
                    color: '#1e293b',
                    fontSize: '1.1rem'
                  }}>
                    📍 מיקום נוכחי (GPS)
                  </label>
                  
                  <button
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            setRideForm({
                              ...rideForm,
                              srcLat: position.coords.latitude.toString(),
                              srcLon: position.coords.longitude.toString()
                            });
                          },
                          (error) => {
                            setError('לא ניתן לקבל מיקום: ' + error.message);
                          }
                        );
                      } else {
                        setError('הדפדפן לא תומך ב-GPS');
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      fontSize: '1.1rem',
                      backgroundColor: '#0ea5e9',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#0284c7';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(14, 165, 233, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#0ea5e9';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(14, 165, 233, 0.3)';
                    }}
                  >
                    📍 קבל מיקום נוכחי
                  </button>
                  
                  {(rideForm.srcLat && rideForm.srcLon) && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      backgroundColor: '#f0f9ff',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      color: '#0369a1',
                      fontWeight: '600'
                    }}>
                      <strong>מיקום נוכחי:</strong> {rideForm.srcLat}, {rideForm.srcLon}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem',
                    fontWeight: '600',
                    color: '#555'
                  }}>
                    מספר תחנה:
                  </label>
                  <input
                    type="number"
                    value={rideForm.StationNumber}
                    onChange={(e) => setRideForm({...rideForm, StationNumber: parseInt(e.target.value) || 0})}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '1rem',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <button
                  onClick={async () => {
                    if (!rideForm.srcLat || !rideForm.srcLon) {
                      setError('יש למלא את כל השדות הנדרשים (מיקום)');
                      return;
                    }

                    if (generatedNumbers.length === 0) {
                      setError('יש ליצור מספרים קודם (לחץ על "צור מספרים")');
                      return;
                    }

                    setFetchingAccessPoint(true);
                    setError(null);

                    try {
                      const token = tokens.id_token || tokens.access_token;
                      
                      if (!token) {
                        throw new Error('לא נמצא token. יש להתחבר מחדש.');
                      }

                      // נסה כל מספר עד שנמצא אחד שעובד
                      let foundAccessPoint = false;
                      let accessPointData = null;
                      let workingJourneyAccessPointNumber = '';

                      for (let i = 0; i < generatedNumbers.length; i++) {
                        const journeyNumber = generatedNumbers[i];
                        try {
                          setCurrentTryingNumber(`מנסה ${i + 1}/${generatedNumbers.length}: ${journeyNumber}`);
                          console.log(`מנסה מספר נקודת גישה: ${journeyNumber} (${i + 1}/${generatedNumbers.length})`);
                          
                          const response = await fetch('/api/zuzu/getJourneyAccessPoint', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                              token: token,
                              cookies: zuzuCookies || undefined,
                              JourneyAccessPointNumber: journeyNumber,
                              srcGPS: {
                                lat: parseFloat(rideForm.srcLat),
                                lon: parseFloat(rideForm.srcLon)
                              },
                              StationNumber: rideForm.StationNumber || 0
                            })
                          });

                          if (response.ok) {
                            accessPointData = await response.json();
                            workingJourneyAccessPointNumber = journeyNumber;
                            foundAccessPoint = true;
                            console.log(`✓ נמצא מספר נקודת גישה עובד: ${journeyNumber}`);
                            break;
                          } else {
                            let errorText = '';
                            try {
                              const errorData = await response.json();
                              errorText = errorData.error || errorData.message || `Status ${response.status}`;
                            } catch (e) {
                              errorText = `Status ${response.status}`;
                            }
                            console.log(`✗ מספר ${journeyNumber} לא עבד: ${errorText}`);
                          }
                        } catch (err: any) {
                          console.log(`✗ שגיאה עם מספר ${journeyNumber}:`, err?.message || err);
                          continue;
                        }
                      }

                      setCurrentTryingNumber('');

                      if (!foundAccessPoint) {
                        throw new Error(`לא נמצא מספר נקודת גישה תקף מתוך ${generatedNumbers.length} מספרים שנוסו. נסה לשנות את הפרמטרים (Base Prefix, Center Suffix, Delta) או לבדוק את הקונסול לפרטים.`);
                      }

                      // עדכן את הטופס עם המספר שנמצא
                      setRideForm({
                        ...rideForm,
                        JourneyAccessPointNumber: workingJourneyAccessPointNumber
                      });

                      setJourneyAccessPoint(accessPointData);
                      setError(null); // נקה שגיאות קודמות אם הצליח
                    } catch (err: any) {
                      console.error('שגיאה בקבלת נקודת גישה:', err);
                      setError(err?.message || 'שגיאה לא ידועה בקבלת נקודת גישה');
                      setCurrentTryingNumber('');
                    } finally {
                      setFetchingAccessPoint(false);
                      setCurrentTryingNumber('');
                    }
                  }}
                  disabled={fetchingAccessPoint || generatedNumbers.length === 0 || !rideForm.srcLat || !rideForm.srcLon || !tokens}
                  style={{
                    width: '100%',
                    padding: '1rem 1.5rem',
                    fontSize: '1.1rem',
                    backgroundColor: (fetchingAccessPoint || generatedNumbers.length === 0 || !rideForm.srcLat || !rideForm.srcLon || !tokens) ? '#94a3b8' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (fetchingAccessPoint || generatedNumbers.length === 0 || !rideForm.srcLat || !rideForm.srcLon || !tokens) ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    opacity: (fetchingAccessPoint || generatedNumbers.length === 0 || !rideForm.srcLat || !rideForm.srcLon || !tokens) ? 0.6 : 1
                  }}
                >
                  {!tokens ? 'יש להתחבר קודם' : fetchingAccessPoint ? (currentTryingNumber ? currentTryingNumber : 'מביא נתונים...') : '🔍 קבל נקודת גישה'}
                </button>

                {journeyAccessPoint && (
                  <div style={{
                    marginTop: '1.5rem',
                    padding: '1.5rem',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '6px',
                    border: '2px solid #10b981'
                  }}>
                    <div style={{
                      fontSize: '1.2rem',
                      fontWeight: '700',
                      color: '#10b981',
                      marginBottom: '1rem',
                      textAlign: 'center'
                    }}>
                      ✓ נתוני נקודת גישה
                    </div>
                    <div style={{
                      padding: '1rem',
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      fontFamily: 'monospace',
                      overflow: 'auto',
                      maxHeight: '300px',
                      marginBottom: '1rem'
                    }}>
                      <pre>{JSON.stringify(journeyAccessPoint, null, 2)}</pre>
                    </div>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(journeyAccessPoint, null, 2))}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1.5rem',
                        fontSize: '1rem',
                        backgroundColor: '#0070f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      העתק תשובה
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

