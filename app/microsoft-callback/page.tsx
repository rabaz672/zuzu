'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function MicrosoftCallback() {
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      
      const authCode = params.get('code');
      const authState = params.get('state');
      const authError = params.get('error');
      const errorDescription = params.get('error_description');

      if (authError) {
        setError(`${authError}: ${errorDescription || ''}`);
      } else if (authCode) {
        setCode(authCode);
        setState(authState);
        
        const codeData = {
          code: authCode,
          state: authState,
          timestamp: new Date().toISOString(),
          url: window.location.href
        };
        
        localStorage.setItem('microsoft_auth_code', JSON.stringify(codeData));
        setSaved(true);
      }
    }
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('הועתק ללוח!');
    });
  };

  const downloadCode = () => {
    if (!code) return;
    
    const data = {
      code: code,
      state: state,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `microsoft-auth-code-${Date.now()}.json`;
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
        maxWidth: '800px', 
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
          Microsoft Authorization Code
        </h1>

        {error && (
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#fef2f2',
            borderRadius: '6px',
            border: '2px solid #ef4444',
            marginBottom: '2rem'
          }}>
            <div style={{
              fontSize: '1.2rem',
              fontWeight: '700',
              color: '#ef4444',
              marginBottom: '0.5rem'
            }}>
              שגיאה
            </div>
            <div style={{ color: '#991b1b' }}>
              {error}
            </div>
          </div>
        )}

        {code && (
          <>
            {saved && (
              <div style={{
                padding: '1rem',
                backgroundColor: '#f0fdf4',
                borderRadius: '6px',
                border: '1px solid #10b981',
                marginBottom: '2rem',
                textAlign: 'center',
                color: '#166534',
                fontWeight: '600'
              }}>
                ✓ הקוד נשמר ב-localStorage
              </div>
            )}

            <div style={{
              marginBottom: '2rem',
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
                  onClick={() => copyToClipboard(JSON.stringify({
                    code,
                    state,
                    timestamp: new Date().toISOString()
                  }, null, 2))}
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
                  העתק הכל
                </button>
              </div>
            </div>

            <div style={{
              padding: '1rem',
              backgroundColor: '#fef3c7',
              borderRadius: '6px',
              border: '1px solid #fbbf24',
              fontSize: '0.9rem',
              color: '#92400e'
            }}>
              <strong>הערה:</strong> הקוד נשמר אוטומטית ב-localStorage של הדפדפן. 
              אתה יכול לגשת אליו דרך Developer Tools → Application → Local Storage.
            </div>
          </>
        )}

        {!code && !error && (
          <div style={{
            padding: '1.5rem',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            ממתין לקוד...
          </div>
        )}
      </div>
    </div>
  );
}

