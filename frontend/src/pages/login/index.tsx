import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { AppLogo } from '@/components/common/AppLogo';
import { PrimaryButton } from '@/components/common/Button';
import mascotImg from '@/assets/illustrations/mascot.webp';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, error, clearError } = useAuthStore();
  const formRef = useRef<HTMLFormElement>(null);
  const submitLockRef = useRef(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isWorking = isSubmitting;
  const isFormValid = email.trim() !== '' && password.trim() !== '';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitLockRef.current) return;
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
      submitLockRef.current = true;
      setIsSubmitting(true);
      await login(email, password);
      navigate('/', { replace: true });
    } catch {
      // The auth store distinguishes connection, credential, and server errors.
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const displayError = formError || error;

  return (
    <main className="story-login-shell story-login-shell--storybook">
      <div className="story-login-glow" aria-hidden="true" />

      <section className="story-login-panel story-login-panel--storybook">
        <div className="story-login-brand story-login-brand--storybook">
          <div className="story-login-brand__top">
            <AppLogo size="md" />
            <span className="story-login-badge">안 1</span>
          </div>

          <div className="story-login-brand__copy">
            <h2>사진 한 장으로 아이의 상상이 시작돼요</h2>
            <p>
              사진을 올리고 원하는 이야기를 고르면 AI가 아이만의 특별한 장면을 만들어 줍니다.
              복잡한 프롬프트 없이 카드만 선택해 주세요.
            </p>
          </div>

          <div className="story-login-illustration" aria-hidden="true">
            <img src={mascotImg} alt="" />
            <span className="story-float story-float--one">✦</span>
            <span className="story-float story-float--two">☁</span>
            <span className="story-float story-float--three">⌁</span>
          </div>
        </div>

        <div className="story-login-card story-login-card--storybook">
          <div className="story-login-card__heading">
            <span className="story-eyebrow">Story Lens</span>
            <h2>다시 오신 것을 환영해요</h2>
            <p>아이디와 비밀번호를 입력해 주세요.</p>
          </div>

          <form ref={formRef} onSubmit={handleSubmit} noValidate className="story-login-form">
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
                aria-invalid={!!displayError}
                aria-describedby={displayError ? 'login-error' : undefined}
              />
            </div>

            <div className="story-form-group">
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
                aria-invalid={!!displayError}
                aria-describedby={displayError ? 'login-error' : undefined}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && isFormValid && !isWorking) {
                    event.preventDefault();
                    formRef.current?.requestSubmit();
                  }
                }}
              />
            </div>

            {displayError && (
              <div id="login-error" role="alert" aria-live="polite" className="story-alert">
                {displayError}
              </div>
            )}

            <PrimaryButton
              type="submit"
              fullWidth
              size="lg"
              isLoading={isWorking}
              disabled={!isFormValid || isWorking}
              className="story-login-submit"
            >
              {isWorking ? '로그인 중...' : '이야기 만들러 가기'}
            </PrimaryButton>
          </form>
        </div>
      </section>
    </main>
  );
}
