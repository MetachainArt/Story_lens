import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { AppLogo } from '@/components/common/AppLogo';
import { PrimaryButton } from '@/components/common/Button';
import mascotImg from '@/assets/illustrations/mascot.png';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, error, clearError } = useAuthStore();
  const formRef = useRef<HTMLFormElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isWorking = isSubmitting;

  const isFormValid = email.trim() !== '' && password.trim() !== '';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    clearError();

    if (!email.trim()) {
      setFormError('아이디를 입력해 주세요.');
      return;
    }
    if (!password.trim()) {
      setFormError('비밀번호를 입력해 주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login(email, password);
      navigate('/', { replace: true });
    } catch {
      setFormError('아이디 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = formError || error;

  return (
    <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      {/* Mesh Animated Background */}
      <div className="mesh-background" aria-hidden="true" />
      
      <div className="story-content-container animate-float" style={{ maxWidth: 440, position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <img src={mascotImg} alt="Story Lens" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', boxShadow: 'var(--shadow-cute)' }} />
          <AppLogo size="lg" />
        </div>

        <section style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e5e7eb', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <h2
              style={{
                fontFamily: 'var(--font-family-serif)',
                fontSize: '1.85rem',
                fontWeight: '800',
                color: '#111827',
                letterSpacing: '-0.02em',
                marginBottom: 6,
              }}
            >
              어쩌면, 당신의 이야기
            </h2>
            <p style={{ color: '#4b5563', fontSize: '1rem', fontWeight: 500 }}>
              다시 돌아오신 것을 환영해요.
            </p>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  color: '#1f2937',
                }}
              >
                아이디
              </label>
              <input
                id="email"
                type="text"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (formError || error) {
                    setFormError('');
                    clearError();
                  }
                }}
                disabled={isWorking}
                autoComplete="username"
                placeholder="아이디를 입력해 주세요"
                className="story-field"
                style={{
                  height: '52px',
                  backgroundColor: '#f9fafb',
                  border: '1.5px solid #d1d5db',
                  color: '#111827',
                  fontWeight: 500,
                  borderColor: displayError ? 'var(--color-error)' : undefined,
                }}
                aria-invalid={!!displayError}
                aria-describedby={displayError ? 'login-error' : undefined}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  marginBottom: 8,
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  color: '#1f2937',
                }}
              >
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (formError || error) {
                    setFormError('');
                    clearError();
                  }
                }}
                disabled={isWorking}
                autoComplete="current-password"
                placeholder="비밀번호를 입력해 주세요"
                className="story-field"
                style={{
                  height: '52px',
                  backgroundColor: '#f9fafb',
                  border: '1.5px solid #d1d5db',
                  color: '#111827',
                  fontWeight: 500,
                  borderColor: displayError ? 'var(--color-error)' : undefined,
                }}
                aria-invalid={!!displayError}
                aria-describedby={displayError ? 'login-error' : undefined}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && isFormValid) {
                    formRef.current?.requestSubmit();
                  }
                }}
              />
            </div>

            {displayError && (
              <div
                id="login-error"
                role="alert"
                aria-live="polite"
                style={{
                  marginBottom: 20,
                  borderRadius: '12px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  padding: '12px 16px',
                }}
              >
                <div style={{ color: '#ef4444', fontWeight: 'bold' }}>!</div>
                <p style={{ fontSize: '0.9rem', color: '#ef4444', fontWeight: '700' }}>
                  {displayError}
                </p>
              </div>
            )}

            <PrimaryButton
              type="submit"
              fullWidth
              size="lg"
              isLoading={isWorking}
              disabled={!isFormValid || isWorking}
              style={{
                height: '56px',
                fontSize: '1.15rem',
                fontWeight: '700',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 4px 6px -1px var(--color-primary-disabled)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>{isWorking ? '로그인 중...' : '로그인 하기'}</span>
              {!isWorking && (
                <span aria-hidden="true" style={{ fontSize: '1.4rem', lineHeight: 1 }}>
                  →
                </span>
              )}
            </PrimaryButton>
          </form>

        </section>

        <p
          style={{
            marginTop: 24,
            textAlign: 'center',
            color: 'var(--color-text-light)',
            fontSize: '0.85rem',
            letterSpacing: '0.05em'
          }}
        >
          STORY LENS 교육용 프로젝트
        </p>
      </div>
    </div>
  );
}
