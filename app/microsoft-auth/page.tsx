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
  const [code, setCode] = useState('');
  const [userInfo, setUserInfo] = useState<any>(null);
  const [sessionCookie, setSessionCookie] = useState<string>('');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [step, setStep] = useState<'id' | 'code' | 'microsoft'>('id');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetUserInfo = async () => {
    if (!idNumber.trim()) {
      setError('מספר ת.ז. נדרש');
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
        throw new Error(data.error || 'שגיאה בקבלת פרטי המשתמש');
      }

      setUserInfo(data);
      if (data.sessionCookie) {
        setSessionCookie(data.sessionCookie);
      }
      setStep('code');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateCode = async () => {
    if (!idNumber.trim() || !code.trim()) {
      setError('מספר ת.ז. וקוד אמינות נדרשים');
      return;
    }

    if (!sessionCookie) {
      setError('יש לקבל קודם את פרטי המשתמש');
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
        throw new Error(data.error || 'שגיאה באימות הקוד');
      }

      setValidationResult(data);
      
      if (data.isValid && data.upn) {
        setStep('microsoft');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateMicrosoftAuthUrl = (upn: string) => {
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

  const handleOpenMicrosoftAuth = () => {
    if (!validationResult?.upn) {
      setError('UPN לא זמין');
      return;
    }

    const authUrl = generateMicrosoftAuthUrl(validationResult.upn);
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

        {step === 'id' && (
          <>
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
              onClick={handleGetUserInfo}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                backgroundColor: '#0078d4',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                fontWeight: '600'
              }}
            >
              {loading ? 'שולח קוד אמינות...' : 'שלח קוד אמינות'}
            </button>
          </>
        )}

        {step === 'code' && userInfo && (
          <>
            <div style={{
              marginBottom: '2rem',
              padding: '1rem',
              backgroundColor: '#f0f9ff',
              borderRadius: '6px',
              border: '1px solid #bae6fd'
            }}>
              <p style={{ margin: 0, color: '#0369a1', fontWeight: '600' }}>
                קוד אמינות נשלח לטלפון: {userInfo.mobilePhone}
              </p>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#555'
              }}>
                קוד אמינות
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="הכנס את קוד האמינות שקיבלת"
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

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              <button
                onClick={() => {
                  setStep('id');
                  setCode('');
                  setUserInfo(null);
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
                חזור
              </button>
              <button
                onClick={handleValidateCode}
                disabled={loading}
                style={{
                  flex: 2,
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  backgroundColor: '#0078d4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  fontWeight: '600'
                }}
              >
                {loading ? 'מאמת...' : 'אמת קוד'}
              </button>
            </div>
          </>
        )}

        {step === 'microsoft' && validationResult?.isValid && (
          <>
            <div style={{
              marginBottom: '2rem',
              padding: '1.5rem',
              backgroundColor: '#f0fdf4',
              borderRadius: '6px',
              border: '2px solid #10b981',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '3rem',
                marginBottom: '1rem'
              }}>
                ✓
              </div>
              <div style={{
                fontSize: '1.2rem',
                fontWeight: '700',
                color: '#10b981',
                marginBottom: '1rem'
              }}>
                אימות הצליח!
              </div>
              <div style={{
                padding: '1rem',
                backgroundColor: 'white',
                borderRadius: '6px',
                marginTop: '1rem',
                textAlign: 'right',
                fontSize: '0.9rem'
              }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>UPN:</strong> {validationResult.upn}
                </div>
                <div>
                  <strong>רשום במערכת:</strong> {validationResult.isRegistered ? 'כן' : 'לא'}
                </div>
              </div>
            </div>

            <div style={{
              marginBottom: '2rem',
              padding: '1rem',
              backgroundColor: '#fef3c7',
              borderRadius: '6px',
              border: '1px solid #fbbf24'
            }}>
              <p style={{ margin: 0, color: '#92400e', fontWeight: '600' }}>
                כעת תוכל להתחבר ל-Microsoft עם הכניסה הפיזית
              </p>
            </div>

            <button
              onClick={handleOpenMicrosoftAuth}
              style={{
                width: '100%',
                padding: '1rem 1.5rem',
                fontSize: '1.1rem',
                backgroundColor: '#0078d4',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginBottom: '1rem'
              }}
            >
              <span>🔐</span>
              <span>התחבר ל-Microsoft</span>
            </button>

            <button
              onClick={() => {
                setStep('id');
                setIdNumber('');
                setCode('');
                setUserInfo(null);
                setValidationResult(null);
              }}
              style={{
                width: '100%',
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
          </>
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

