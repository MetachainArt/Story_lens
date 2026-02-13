/**
 * Home Page - Vintage Cute Style
 */
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const userName = user?.name || null

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        background: 'linear-gradient(160deg, #FFF5EB 0%, #FFF0E0 50%, #FCEBD5 100%)',
      }}
    >
      {/* Logo area */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div
          style={{
            width: 80,
            height: 80,
            margin: '0 auto 1rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #D4845A 0%, #E8B86D 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(212,132,90,0.25)',
            border: '3px solid rgba(255,255,255,0.5)',
          }}
        >
          <span style={{ fontSize: '2.2rem' }}>&#x1F4F7;</span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-family-serif)',
            fontSize: '1.8rem',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            letterSpacing: '0.08em',
            marginBottom: '0.3rem',
          }}
        >
          Story Lens
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-family-serif)',
            fontSize: '0.85rem',
            color: 'var(--color-text-secondary)',
            letterSpacing: '0.15em',
          }}
        >
          &#x2727; &#xB098;&#xB9CC;&#xC758; &#xC774;&#xC57C;&#xAE30;&#xB97C; &#xB2F4;&#xB2E4; &#x2727;
        </p>
      </div>

      {/* Greeting */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 'var(--radius-2xl)',
          padding: '1rem 2rem',
          marginBottom: '2rem',
          boxShadow: 'var(--shadow-sm)',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '1.1rem', color: 'var(--color-text-primary)' }}>
          {userName
            ? <>&#x1F44B; &#xC548;&#xB155;&#xD558;&#xC138;&#xC694;, <strong>{userName}</strong>&#xB2D8;!</>
            : <>&#x1F44B; &#xC548;&#xB155;&#xD558;&#xC138;&#xC694;!</>
          }
        </p>
      </div>

      {/* Main buttons */}
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Take Photo - main CTA */}
        <button
          onClick={() => navigate('/camera')}
          style={{
            width: '100%',
            height: 110,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'linear-gradient(135deg, #D4845A 0%, #C47550 100%)',
            color: '#FFF8F0',
            border: '2px solid rgba(255,255,255,0.25)',
            borderRadius: 'var(--radius-2xl)',
            boxShadow: '0 6px 24px rgba(212,132,90,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
            cursor: 'pointer',
            fontFamily: 'var(--font-family)',
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; }}
        >
          <span style={{ fontSize: '2rem' }}>&#x1F4F8;</span>
          <span style={{ fontSize: '1.3rem', fontWeight: 600, letterSpacing: '0.05em' }}>
            &#xC0AC;&#xC9C4; &#xCC0D;&#xAE30;
          </span>
        </button>

        {/* My Photos */}
        <button
          onClick={() => navigate('/gallery')}
          style={{
            width: '100%',
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            border: '2px dashed var(--color-border)',
            borderRadius: 'var(--radius-2xl)',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            fontFamily: 'var(--font-family)',
            fontSize: '1.1rem',
            fontWeight: 600,
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'var(--color-primary)';
            e.currentTarget.style.backgroundColor = 'var(--color-primary-light)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.backgroundColor = 'var(--color-surface)';
          }}
        >
          <span style={{ fontSize: '1.3rem' }}>&#x1F5BC;&#xFE0F;</span>
          <span>&#xB0B4; &#xC0AC;&#xC9C4; &#xBCF4;&#xAE30;</span>
        </button>

        {/* Schedule */}
        <button
          onClick={() => navigate('/sessions')}
          style={{
            width: '100%',
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            border: '2px dashed var(--color-border)',
            borderRadius: 'var(--radius-2xl)',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            fontFamily: 'var(--font-family)',
            fontSize: '1.1rem',
            fontWeight: 600,
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'var(--color-primary)';
            e.currentTarget.style.backgroundColor = 'var(--color-primary-light)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.backgroundColor = 'var(--color-surface)';
          }}
        >
          <span style={{ fontSize: '1.3rem' }}>&#x1F5D3;&#xFE0F;</span>
          <span>&#xC6D4;&#xBCC4; &#xC77C;&#xC815; &#xBCF4;&#xAE30;</span>
        </button>
      </div>

      {/* Footer decoration */}
      <p
        style={{
          marginTop: '2.5rem',
          fontSize: '0.8rem',
          color: 'var(--color-text-light)',
          letterSpacing: '0.2em',
          fontFamily: 'var(--font-family-serif)',
        }}
      >
        &#x2661; &#xAFC8;&#xAFB8;&#xB294; &#xCE74;&#xBA54;&#xB77C; &#x2661;
      </p>
    </main>
  )
}
