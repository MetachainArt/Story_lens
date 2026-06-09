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
    <main className="story-login-shell">
      <div className="mesh-background" aria-hidden="true" />

      <section className="story-login-panel">
        <div className="story-login-brand">
          <div>
            <AppLogo size="md" />
            <h2>사진으로 시작하는 쉬운 이야기 교실</h2>
            <p>
              사진을 찍고, AI 이미지로 바꾸고, 글과 보관함까지 한 번에 이어집니다.
              어린이와 초보자도 큰 버튼만 보고 사용할 수 있게 정리했어요.
            </p>
          </div>
          <img src={mascotImg} alt="" className="story-login-mascot" />
        </div>

        <div className="story-login-card">
          <div style={{ marginBottom: 22 }}>
            <span className="story-eyebrow">로그인</span>
            <h2 style={{ marginTop: 10 }}>다시 오신 것을 환영해요</h2>
            <p style={{ marginTop: 6 }}>아이디와 비밀번호를 입력해 주세요.</p>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} noValidate>
            <div className="story-form-group">
              <label htmlFor="email" className="story-form-label">아이디</label>
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
                style={{ height: 54, borderColor: displayError ? 'var(--color-error)' : undefined }}
                aria-invalid={!!displayError}
                aria-describedby={displayError ? 'login-error' : undefined}
              />
            </div>

            <div className="story-form-group" style={{ marginBottom: 20 }}>
              <label htmlFor="password" className="story-form-label">비밀번호</label>
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
                style={{ height: 54, borderColor: displayError ? 'var(--color-error)' : undefined }}
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
              <div id="login-error" role="alert" aria-live="polite" className="story-alert" style={{ marginBottom: 16 }}>
                {displayError}
              </div>
            )}

            <PrimaryButton
              type="submit"
              fullWidth
              size="lg"
              isLoading={isWorking}
              disabled={!isFormValid || isWorking}
              style={{ width: '100%', borderRadius: 8 }}
            >
              {isWorking ? '로그인 중...' : '로그인 하기'}
            </PrimaryButton>
          </form>
        </div>
      </section>
    </main>
  );
}
