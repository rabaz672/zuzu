'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const MICROSOFT_CONFIG = {
  tenantId: '78820852-55fa-450b-908d-45c0d911e76b',
  clientId: '2d82cc91-ca5a-45bb-9a8d-4d33c6cb7cc5',
  redirectUri: 'https://www.home.idf.il/',
  scope: 'User.Read openid profile offline_access',
  authorizationEndpoint: 'https://login.microsoftonline.com/78820852-55fa-450b-908d-45c0d911e76b/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/78820852-55fa-450b-908d-45c0d911e76b/oauth2/v2.0/token'
};

const FIXED_DESTINATION = {
  name: 'פיקוד העורף',
  lat: 31.92101,
  lon: 34.876663
};

export default function Home() {
  const [idNumber, setIdNumber] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [tokens, setTokens] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [zuzuRide, setZuzuRide] = useState<any>(null);
  const [creatingRide, setCreatingRide] = useState(false);
  const [currentTryingNumber, setCurrentTryingNumber] = useState<string>('');
  const [zuzuCookies] = useState('incap_ses_253_2822305=wBpreGMaVl04Vy8Jm9aCAxlaOWkAAAAAiAlbEISZnK1hjd6wadzCfQ%3D%3D; nlbi_2822305=RWMFJqPvxSyS7XMcJBgSsAAAAADC9DsvCu29c5WJMGhZBqDy; visid_incap_2822305=qqJBPEbOSSaskgB8LtKCFy1CNWkAAAAAQUIPAAAAAAChAggeVnzsb%2BrXgRJwWMBC');
  const [busId, setBusId] = useState('');
  const [replyId, setReplyId] = useState<string | null>(null);
  const [rideForm, setRideForm] = useState({
    JourneyAccessPointNumber: '',
    PassengersNumber: 1,
    srcLat: '',
    srcLon: '',
    destLat: FIXED_DESTINATION.lat.toString(),
    destLon: FIXED_DESTINATION.lon.toString(),
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

  const handleCreateRide = async () => {
    if (!busId) {
      setError('יש לסרוק ברקוד אוטובוס');
      return;
    }

    if (!rideForm.srcLat || !rideForm.srcLon) {
      setError('יש לקבל מיקום נוכחי');
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
      }

      setCurrentTryingNumber(`בודק מזהה אוטובוס: ${busId}`);
      
      const accessPointResponse = await fetch('/api/zuzu/getJourneyAccessPoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: token,
          cookies: zuzuCookies || undefined,
          JourneyAccessPointNumber: busId,
          srcGPS: {
            lat: parseFloat(rideForm.srcLat),
            lon: parseFloat(rideForm.srcLon)
          },
          StationNumber: rideForm.StationNumber || 0
        })
      });

      if (!accessPointResponse.ok) {
        throw new Error('מזהה אוטובוס לא תקף');
      }

      const accessPointData = await accessPointResponse.json();
      const journeyReplyId = accessPointData?.replyId || accessPointData?.replyID;
      setReplyId(journeyReplyId);
      setCurrentTryingNumber('');

      const response = await fetch('/api/zuzu/createRide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: token,
          cookies: zuzuCookies || undefined,
          replyId: journeyReplyId,
          JourneyAccessPointNumber: busId,
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
      setError(null);
    } catch (err: any) {
      console.error('שגיאה ביצירת נסיעה:', err);
      setError(err?.message || 'שגיאה לא ידועה ביצירת נסיעה');
    } finally {
      setCreatingRide(false);
      setCurrentTryingNumber('');
    }
  };

  useEffect(() => {
    const savedTokens = localStorage.getItem('microsoft_auth_tokens');
    if (savedTokens) {
      try {
        const data = JSON.parse(savedTokens);
        if (data.tokens) {
          setTokens(data.tokens);
          if (data.idNumber) {
            setIdNumber(data.idNumber);
          }
        }
      } catch (e) {
        console.error('Error loading saved tokens:', e);
      }
    }
  }, []);

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ 
        maxWidth: '600px', 
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '2.5rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚌</div>
          <h1 style={{ 
            fontSize: '2.5rem', 
            margin: 0,
            marginBottom: '0.5rem',
            color: '#1e293b',
            fontWeight: '800'
          }}>
            ZUZU
          </h1>
          <p style={{ 
            fontSize: '1.1rem', 
            color: '#64748b',
            margin: 0
          }}>
            מערכת הזמנת נסיעות
          </p>
        </div>

        {!tokens ? (
          <>
            <div style={{
              marginBottom: '2rem',
              padding: '1.5rem',
              backgroundColor: '#f0f9ff',
              borderRadius: '12px',
              border: '2px solid #0ea5e9'
            }}>
              <h2 style={{
                fontSize: '1.3rem',
                fontWeight: '700',
                color: '#0ea5e9',
                marginBottom: '1rem',
                textAlign: 'center'
              }}>
                🔐 התחברות
              </h2>
              <p style={{ margin: 0, color: '#0369a1', fontSize: '0.95rem', textAlign: 'center' }}>
                הכנס את מספר ת.ז. שלך כדי להתחבר
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.75rem',
                fontWeight: '600',
                color: '#1e293b',
                fontSize: '1rem'
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
                  padding: '1rem',
                  fontSize: '1.1rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            <button
              onClick={handleConnect}
              disabled={loading || !idNumber.trim()}
              style={{
                width: '100%',
                padding: '1.25rem 1.5rem',
                fontSize: '1.2rem',
                background: loading || !idNumber.trim() 
                  ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: loading || !idNumber.trim() ? 'not-allowed' : 'pointer',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                boxShadow: loading || !idNumber.trim() 
                  ? 'none'
                  : '0 4px 15px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s',
                marginBottom: '1.5rem'
              }}
              onMouseEnter={(e) => {
                if (!loading && idNumber.trim()) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
              }}
            >
              <span>🔐</span>
              <span>{loading ? 'מתחבר...' : 'התחבר'}</span>
            </button>

            {!code && (
              <div style={{
                marginTop: '2rem',
                padding: '1.5rem',
                backgroundColor: '#fef3c7',
                borderRadius: '12px',
                border: '2px solid #fbbf24'
              }}>
                <h3 style={{
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: '#92400e',
                  marginBottom: '1rem',
                  textAlign: 'center'
                }}>
                  אחרי ההתחברות:
                </h3>
                <p style={{
                  marginBottom: '1rem',
                  color: '#92400e',
                  fontSize: '0.95rem',
                  lineHeight: '1.6'
                }}>
                  תועבר ל-<code style={{ backgroundColor: '#fde68a', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>https://www.prat.idf.il/</code> עם הקוד ב-URL.
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
                      padding: '0.875rem',
                      fontSize: '0.95rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    onClick={handleExtractCode}
                    disabled={!urlInput.trim() || exchanging}
                    style={{
                      padding: '0.875rem 1.5rem',
                      background: !urlInput.trim() || exchanging
                        ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: !urlInput.trim() || exchanging ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {exchanging ? 'מעבד...' : 'חלץ קוד'}
                  </button>
                </div>
              </div>
            )}

            {exchanging && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1.5rem',
                backgroundColor: '#fef3c7',
                borderRadius: '12px',
                border: '2px solid #fbbf24',
                textAlign: 'center',
                color: '#92400e',
                fontWeight: '600'
              }}>
                ⏳ מעבד את הקוד...
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{
              marginBottom: '2rem',
              padding: '1.5rem',
              backgroundColor: '#f0fdf4',
              borderRadius: '12px',
              border: '2px solid #10b981',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✅</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#10b981' }}>
                מחובר בהצלחה
              </div>
            </div>

            <div style={{ 
              marginBottom: '2rem', 
              padding: '2rem', 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '16px',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
            }}>
              <div style={{ 
                textAlign: 'center',
                color: 'white',
                marginBottom: '1.5rem'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚌</div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', margin: 0 }}>
                  סריקת ברקוד אוטובוס
                </h3>
                <p style={{ fontSize: '1rem', opacity: 0.9, marginTop: '0.5rem' }}>
                  סרוק את הברקוד מהאוטובוס או הזן ידנית
                </p>
              </div>
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
                  padding: '1.25rem',
                  fontSize: '1.3rem',
                  border: 'none',
                  borderRadius: '10px',
                  boxSizing: 'border-box',
                  fontFamily: 'monospace',
                  textAlign: 'center',
                  fontWeight: '600',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}
              />
            </div>

            <div style={{ 
              marginBottom: '2rem', 
              padding: '1.5rem', 
              backgroundColor: '#f0fdf4',
              borderRadius: '12px',
              border: '2px solid #10b981',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <div style={{ fontSize: '2rem' }}>🎯</div>
                <div>
                  <h3 style={{ 
                    fontSize: '1.2rem', 
                    fontWeight: '700', 
                    color: '#10b981',
                    margin: 0
                  }}>
                    יעד קבוע
                  </h3>
                  <p style={{ 
                    fontSize: '0.9rem', 
                    color: '#666',
                    margin: '0.25rem 0 0 0'
                  }}>
                    {FIXED_DESTINATION.name}
                  </p>
                </div>
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
                    📍 קבל מיקום
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
                  color: '#0369a1',
                  fontWeight: '600'
                }}>
                  <strong>מיקום נוכחי:</strong> {rideForm.srcLat}, {rideForm.srcLon}
                </div>
              )}
            </div>

            <button
              onClick={handleCreateRide}
              disabled={creatingRide || !busId || !rideForm.srcLat || !rideForm.srcLon}
              style={{
                width: '100%',
                padding: '1.25rem 1.5rem',
                fontSize: '1.3rem',
                background: creatingRide || !busId || !rideForm.srcLat || !rideForm.srcLon
                  ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: creatingRide || !busId || !rideForm.srcLat || !rideForm.srcLon ? 'not-allowed' : 'pointer',
                fontWeight: '700',
                marginTop: '1rem',
                boxShadow: creatingRide || !busId || !rideForm.srcLat || !rideForm.srcLon
                  ? 'none'
                  : '0 4px 15px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                if (!creatingRide && busId && rideForm.srcLat && rideForm.srcLon) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)';
              }}
            >
              {creatingRide ? (currentTryingNumber || 'יוצר נסיעה...') : '🚗 צור נסיעה'}
            </button>

            {zuzuRide && (
              <div style={{
                marginTop: '2rem',
                padding: '2rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                borderRadius: '16px',
                boxShadow: '0 8px 25px rgba(16, 185, 129, 0.3)',
                color: 'white'
              }}>
                <div style={{
                  textAlign: 'center',
                  marginBottom: '2rem'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
                  <h2 style={{
                    fontSize: '1.8rem',
                    fontWeight: '700',
                    margin: 0,
                    marginBottom: '0.5rem'
                  }}>
                    כרטיס נסיעה נוצר בהצלחה!
                  </h2>
                  <p style={{
                    fontSize: '1rem',
                    opacity: 0.9,
                    margin: 0
                  }}>
                    שמור את הברקוד לשימוש בנסיעה
                  </p>
                </div>

                {zuzuRide.journeyQr && (
                  <div style={{
                    padding: '2rem',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    marginBottom: '1.5rem',
                    textAlign: 'center',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                  }}>
                    <div style={{ 
                      fontSize: '1.1rem', 
                      color: '#1e293b', 
                      marginBottom: '1.5rem', 
                      fontWeight: '700'
                    }}>
                      📱 ברקוד נסיעה
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginBottom: '1.5rem',
                      padding: '1.5rem',
                      backgroundColor: '#f9fafb',
                      borderRadius: '12px'
                    }}>
                      <QRCodeSVG 
                        value={zuzuRide.journeyQr}
                        size={250}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      color: '#64748b', 
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                      padding: '0.75rem',
                      backgroundColor: '#f1f5f9',
                      borderRadius: '8px',
                      marginTop: '1rem'
                    }}>
                      {zuzuRide.journeyQr}
                    </div>
                  </div>
                )}

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginBottom: '1.5rem'
                }}>
                  {zuzuRide.TimeLeftForActiveInMs && (
                    <div style={{
                      padding: '1.25rem',
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      borderRadius: '12px',
                      textAlign: 'center',
                      backdropFilter: 'blur(10px)'
                    }}>
                      <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '0.5rem' }}>
                        זמן פעיל
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                        {Math.floor(zuzuRide.TimeLeftForActiveInMs / 1000 / 60)} דקות
                      </div>
                    </div>
                  )}
                  <div style={{
                    padding: '1.25rem',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    borderRadius: '12px',
                    textAlign: 'center',
                    backdropFilter: 'blur(10px)'
                  }}>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '0.5rem' }}>
                      יעד
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>
                      {FIXED_DESTINATION.name}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => {
                      const printWindow = window.open('', '_blank');
                      if (printWindow && zuzuRide.journeyQr) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>כרטיס נסיעה ZUZU</title>
                              <style>
                                body { 
                                  font-family: Arial, sans-serif; 
                                  padding: 2rem; 
                                  text-align: center;
                                  direction: rtl;
                                }
                                .qr-code { margin: 2rem 0; }
                                h1 { color: #10b981; }
                              </style>
                            </head>
                            <body>
                              <h1>כרטיס נסיעה ZUZU</h1>
                              <div class="qr-code">
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${zuzuRide.journeyQr}" />
                              </div>
                              <p><strong>יעד:</strong> ${FIXED_DESTINATION.name}</p>
                              <p><strong>מספר נוסעים:</strong> ${rideForm.PassengersNumber}</p>
                              <p style="font-family: monospace; font-size: 0.9rem; color: #666;">${zuzuRide.journeyQr}</p>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                        setTimeout(() => printWindow.print(), 250);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '1rem 1.5rem',
                      fontSize: '1rem',
                      backgroundColor: 'white',
                      color: '#10b981',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      transition: 'transform 0.2s',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    🖨️ הדפס כרטיס
                  </button>
                  <button
                    onClick={() => {
                      setZuzuRide(null);
                      setBusId('');
                      setRideForm({
                        JourneyAccessPointNumber: '',
                        PassengersNumber: 1,
                        srcLat: '',
                        srcLon: '',
                        destLat: FIXED_DESTINATION.lat.toString(),
                        destLon: FIXED_DESTINATION.lon.toString(),
                        address: '',
                        rideType: 1,
                        codeOperator: '003',
                        StationNumber: 0
                      });
                    }}
                    style={{
                      flex: 1,
                      padding: '1rem 1.5rem',
                      fontSize: '1rem',
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      border: '2px solid white',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                  >
                    🔄 נסיעה חדשה
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#fef2f2',
            borderRadius: '10px',
            border: '2px solid #fecaca',
            color: '#991b1b',
            marginTop: '1.5rem',
            fontWeight: '600'
          }}>
            <strong>שגיאה:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
}
