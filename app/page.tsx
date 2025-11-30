'use client';

import Link from 'next/link';

export default function Home() {
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
        padding: '3rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          marginBottom: '1rem',
          color: '#333'
        }}>
          IDF Authentication Service
        </h1>
        
        <p style={{
          fontSize: '1.1rem',
          color: '#666',
          marginBottom: '3rem'
        }}>
          בחר את סוג הבדיקה שברצונך לבצע
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          <Link 
            href="/check-user"
            style={{
              display: 'block',
              padding: '1.5rem 2rem',
              backgroundColor: '#0070f3',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '1.2rem',
              fontWeight: '600',
              transition: 'background-color 0.2s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0051cc'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0070f3'}
          >
            <div style={{ marginBottom: '0.5rem' }}>✓ בדיקת משתמש</div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9, fontWeight: 'normal' }}>
              בדיקה פשוטה אם מספר ת.ז. קיים במערכת
            </div>
          </Link>

          <Link 
            href="/verify"
            style={{
              display: 'block',
              padding: '1.5rem 2rem',
              backgroundColor: '#10b981',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '1.2rem',
              fontWeight: '600',
              transition: 'background-color 0.2s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
          >
            <div style={{ marginBottom: '0.5rem' }}>🔐 אימות קפדני עם קוד אמינות</div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9, fontWeight: 'normal' }}>
              בדיקת שיוך אמיתי עם קוד אמינות שנשלח לטלפון
            </div>
          </Link>

          <Link 
            href="/microsoft-auth"
            style={{
              display: 'block',
              padding: '1.5rem 2rem',
              backgroundColor: '#0078d4',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '1.2rem',
              fontWeight: '600',
              transition: 'background-color 0.2s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0063b1'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0078d4'}
          >
            <div style={{ marginBottom: '0.5rem' }}>🔒 אימות Microsoft עם כניסה פיזית</div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9, fontWeight: 'normal' }}>
              אימות מלא עם קוד אמינות והתחברות ל-Microsoft
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
