'use client';

import { useState } from 'react';
import Link from 'next/link';

const MICROSOFT_CONFIG = {
  tenantId: '78820852-55fa-450b-908d-45c0d911e76b',
  clientId: '7b202b0a-1a3c-4dc2-8432-a29ae04973d5',
  redirectUri: 'https://www.prat.idf.il/',
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

  const handleFetchUserData = async (idToken: string) => {
    setFetchingUserData(true);
    setError(null);

    try {
      const savedTokens = JSON.parse(localStorage.getItem('microsoft_auth_tokens') || '{}');
      const tokens = savedTokens.tokens || {};
      
      if (!tokens.access_token && !tokens.id_token) {
        throw new Error('לא נמצאו tokens');
      }

      const tokensToTry = [
        { token: tokens.access_token, type: 'access_token' },
        { token: tokens.id_token, type: 'id_token' }
      ].filter(t => t.token);

      let lastError: any = null;

      for (const { token, type } of tokensToTry) {
        try {
          console.log(`מנסה עם ${type}...`);
          const response = await fetch('/api/microsoft/user-data', {
            method: 'POST',
            headers: {
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              token: token
            })
          });

          if (response.ok) {
            const data = await response.json();
            setUserData(data);
            
            const fullData = {
              ...savedTokens,
              userData: data,
              timestamp: new Date().toISOString()
            };
            
            localStorage.setItem('microsoft_auth_complete', JSON.stringify(fullData));
            return;
          } else {
            const errorData = await response.json();
            lastError = new Error(`שגיאה בקבלת נתוני משתמש עם ${type}: ${response.status} - ${errorData.error || 'Unknown error'}`);
            console.log(`נכשל עם ${type}, מנסה הבא...`);
          }
        } catch (err: any) {
          lastError = err;
          console.log(`שגיאה עם ${type}:`, err.message);
        }
      }

      if (lastError) {
        throw lastError;
      }
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
      </div>
    </div>
  );
}

