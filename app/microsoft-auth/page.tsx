'use client';

import { useState } from 'react';
import Link from 'next/link';

const MICROSOFT_CONFIG = {
  tenantId: '78820852-55fa-450b-908d-45c0d911e76b',
  clientId: '7b202b0a-1a3c-4dc2-8432-a29ae04973d5',
  redirectUri: 'https://www.prat.idf.il/',
  scope: 'User.Read openid profile offline_access',
  authorizationEndpoint: 'https://login.microsoftonline.com/78820852-55fa-450b-908d-45c0d911e76b/oauth2/v2.0/authorize'
};

export default function MicrosoftAuth() {
  const [idNumber, setIdNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateMicrosoftAuthUrl = (idNumber: string) => {
    const upn = `${idNumber}@idf.il`;
    
    const params = new URLSearchParams({
      client_id: MICROSOFT_CONFIG.clientId,
      scope: MICROSOFT_CONFIG.scope,
      redirect_uri: MICROSOFT_CONFIG.redirectUri,
      response_mode: 'fragment',
      response_type: 'code',
      login_hint: upn,
      'X-AnchorMailbox': `UPN:${upn}`,
      nonce: crypto.randomUUID(),
      state: btoa(JSON.stringify({ id: crypto.randomUUID(), meta: { interactionType: 'popup' } }))
    });

    return `${MICROSOFT_CONFIG.authorizationEndpoint}?${params.toString()}`;
  };

  const handleConnect = () => {
    if (!idNumber.trim()) {
      setError('מספר ת.ז. נדרש');
      return;
    }

    setError(null);
    const authUrl = generateMicrosoftAuthUrl(idNumber.trim());
    window.open(authUrl, '_blank', 'width=600,height=700');
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

