'use client';

import { useState, useEffect } from 'react';
import IDFClient from '@/lib/idfClient';

export default function Home() {
  const [idNumber, setIdNumber] = useState('');
  const [code, setCode] = useState('');
  const [userInfo, setUserInfo] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [idValidation, setIdValidation] = useState<any>(null);
  const [sessionCookie, setSessionCookie] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proxyStatus, setProxyStatus] = useState<any>(null);
  const [useClientSide, setUseClientSide] = useState<boolean>(true);

  useEffect(() => {
    fetch('/api/proxy-status')
      .then(res => res.json())
      .then(data => setProxyStatus(data))
      .catch(err => console.error('Failed to fetch proxy status:', err));
  }, []);

  const handleGetUserInfo = async () => {
    if (!idNumber.trim()) {
      setError('ID Number is required');
      return;
    }

    setLoading(true);
    setError(null);
    setUserInfo(null);
    setValidationResult(null);
    setSessionCookie('');

    try {
      const response = await fetch('/api/idf/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get user info');
      }

      setUserInfo(data);
      if (data.sessionCookie) {
        setSessionCookie(data.sessionCookie);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateId = async () => {
    if (!idNumber.trim()) {
      setError('ID Number is required');
      return;
    }

    setLoading(true);
    setError(null);
    setIdValidation(null);
    setUserInfo(null);
    setValidationResult(null);

    try {
      const response = await fetch('/api/users/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ idNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate ID');
      }

      setIdValidation(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateCode = async () => {
    if (!idNumber.trim() || !code.trim()) {
      setError('ID Number and Code are required');
      return;
    }

    if (!sessionCookie) {
      setError('Please get user info first to obtain session cookie');
      return;
    }

    setLoading(true);
    setError(null);
    setValidationResult(null);

    try {
      const response = await fetch('/api/idf/validate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          idNumber,
          code,
          sessionCookie
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate code');
      }

      setValidationResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
        <h1 style={{ 
          fontSize: '2rem', 
          marginBottom: '1rem',
          color: '#333',
          textAlign: 'center'
        }}>
          IDF Proxy Service
        </h1>

        {proxyStatus && (
          <div style={{
            marginBottom: '2rem',
            padding: '1rem',
            backgroundColor: proxyStatus.proxyConfigured ? '#f0fdf4' : '#fef2f2',
            borderRadius: '6px',
            border: `1px solid ${proxyStatus.proxyConfigured ? '#86efac' : '#fecaca'}`,
            fontSize: '0.9rem'
          }}>
            <strong style={{ color: proxyStatus.proxyConfigured ? '#166534' : '#991b1b' }}>
              Proxy Status: {proxyStatus.proxyConfigured ? '✓ Configured' : '✗ Not Configured'}
            </strong>
            <p style={{ margin: '0.5rem 0 0 0', color: proxyStatus.proxyConfigured ? '#166534' : '#991b1b' }}>
              {proxyStatus.message}
            </p>
          </div>
        )}

        <div style={{
          marginBottom: '2rem',
          padding: '0.75rem',
          backgroundColor: '#fef3c7',
          borderRadius: '6px',
          border: '1px solid #fbbf24',
          fontSize: '0.9rem'
        }}>
          <p style={{ margin: 0, color: '#92400e', fontWeight: '600' }}>
            ℹ️ Requests go through server (IDF API blocks direct browser requests due to CORS)
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#92400e' }}>
            If server is not in Israel, configure PROXY_URL in Vercel environment variables
          </p>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem',
            fontWeight: '600',
            color: '#555'
          }}>
            ID Number
          </label>
          <input
            type="text"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder="Enter ID Number"
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

        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          marginBottom: '2rem',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handleValidateId}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              fontWeight: '600',
              minWidth: '200px'
            }}
          >
            {loading ? 'Validating...' : 'Validate ID'}
          </button>
          <button
            onClick={handleGetUserInfo}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              fontWeight: '600',
              minWidth: '200px'
            }}
          >
            {loading ? 'Loading...' : 'Get User Info'}
          </button>
        </div>

        {idValidation && (
          <div style={{
            marginBottom: '2rem',
            padding: '1rem',
            backgroundColor: idValidation.isValid ? '#f0fdf4' : '#fef2f2',
            borderRadius: '6px',
            border: `1px solid ${idValidation.isValid ? '#86efac' : '#fecaca'}`
          }}>
            <h2 style={{ marginTop: 0, color: idValidation.isValid ? '#166534' : '#991b1b' }}>
              ID Validation: {idValidation.isValid ? 'Valid ✓' : 'Invalid ✗'}
            </h2>
            {idValidation.mobilePhone && (
              <p style={{ margin: '0.5rem 0', color: '#166534', fontWeight: '600' }}>
                Mobile Phone: {idValidation.mobilePhone}
              </p>
            )}
            {idValidation.error && (
              <p style={{ margin: '0.5rem 0', color: '#991b1b' }}>
                Error: {idValidation.error}
              </p>
            )}
            <pre style={{
              margin: '0.5rem 0 0 0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.9rem'
            }}>
              {JSON.stringify(idValidation, null, 2)}
            </pre>
          </div>
        )}

        {userInfo && (
          <div style={{
            marginBottom: '2rem',
            padding: '1rem',
            backgroundColor: '#f0f9ff',
            borderRadius: '6px',
            border: '1px solid #bae6fd'
          }}>
            <h2 style={{ marginTop: 0, color: '#0369a1' }}>User Info:</h2>
            <p style={{ margin: '0.5rem 0', color: '#0369a1', fontWeight: '600' }}>
              Mobile Phone: {userInfo.mobilePhone}
            </p>
            {sessionCookie && (
              <p style={{ margin: '0.5rem 0', color: '#0369a1', fontSize: '0.9rem' }}>
                Session Cookie saved ✓
              </p>
            )}
            <pre style={{
              margin: '0.5rem 0 0 0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.9rem'
            }}>
              {JSON.stringify(userInfo, null, 2)}
            </pre>
          </div>
        )}

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem',
            fontWeight: '600',
            color: '#555'
          }}>
            Validation Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter validation code"
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

        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={handleValidateCode}
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              fontWeight: '600'
            }}
          >
            {loading ? 'Validating...' : 'Validate Code'}
          </button>
        </div>

        {validationResult && (
          <div style={{
            marginBottom: '2rem',
            padding: '1rem',
            backgroundColor: '#f0fdf4',
            borderRadius: '6px',
            border: '1px solid #86efac'
          }}>
            <h2 style={{ marginTop: 0, color: '#166534' }}>Validation Result:</h2>
            <pre style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.9rem'
            }}>
              {JSON.stringify(validationResult, null, 2)}
            </pre>
          </div>
        )}

        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#fef2f2',
            borderRadius: '6px',
            border: '1px solid #fecaca',
            color: '#991b1b'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
}

