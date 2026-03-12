/**
 * @TASK P1-S1-T1 - Login Page with Form
 * @SPEC specs/screens/login.yaml
 * Accessibility-first login screen for Story Lens
 */

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { AppLogo } from '@/components/common/AppLogo';
import { PrimaryButton } from '@/components/common/Button';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');

  // Form validation
  const isFormValid = email.trim() !== '' && password.trim() !== '';

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setFormError('');
    clearError();

    // Client-side validation
    if (!email.trim()) {
      setFormError('이메일을 입력해주세요');
      return;
    }
    if (!password.trim()) {
      setFormError('비밀번호를 입력해주세요');
      return;
    }

    try {
      await login(email, password);
      // Success - navigate to home
      navigate('/', { replace: true });
    } catch (err: any) {
      // Error handled by auth store
      setFormError('이메일 또는 비밀번호가 올바르지 않습니다');
    }
  };

  // Display error message
  const displayError = formError || error;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: 'var(--color-bg-soft)' }}
    >
      {/* Logo Section - Top 1/3 */}
      <div className="w-full max-w-md mb-12 flex justify-center">
        <AppLogo size="lg" />
      </div>

      {/* Login Form Card */}
      <div
        className="w-full max-w-md rounded-2xl px-8 py-10"
        style={{
          backgroundColor: 'var(--color-surface)',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: 'var(--radius-xl)',
        }}
      >
        <h2
          className="text-2xl font-bold text-center mb-8"
          style={{
            fontSize: 'var(--font-size-h2)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text-primary)',
          }}
        >
          로그인
        </h2>

        <form onSubmit={handleSubmit} noValidate>
          {/* Email Input */}
          <div className="mb-6">
            <label
              htmlFor="email"
              className="block mb-2 text-lg font-semibold"
              style={{
                fontSize: '1.125rem',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
              }}
            >
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (formError || error) {
                  setFormError('');
                  clearError();
                }
              }}
              disabled={isLoading}
              autoComplete="email"
              className="w-full px-4 border-2 transition-all duration-200 focus:outline-none"
              style={{
                height: 'var(--touch-target-min)',
                fontSize: '1.125rem',
                borderRadius: 'var(--radius-lg)',
                borderColor: displayError ? 'var(--color-error)' : 'var(--color-border)',
                backgroundColor: isLoading ? 'var(--color-bg-soft)' : 'white',
                color: 'var(--color-text-primary)',
              }}
              onFocus={(e) => {
                if (!displayError) {
                  e.target.style.borderColor = 'var(--color-primary)';
                }
              }}
              onBlur={(e) => {
                if (!displayError) {
                  e.target.style.borderColor = 'var(--color-border)';
                }
              }}
              placeholder="이메일을 입력하세요"
              aria-invalid={!!displayError}
              aria-describedby={displayError ? 'login-error' : undefined}
            />
          </div>

          {/* Password Input */}
          <div className="mb-6">
            <label
              htmlFor="password"
              className="block mb-2 text-lg font-semibold"
              style={{
                fontSize: '1.125rem',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
              }}
            >
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (formError || error) {
                  setFormError('');
                  clearError();
                }
              }}
              disabled={isLoading}
              autoComplete="current-password"
              className="w-full px-4 border-2 transition-all duration-200 focus:outline-none"
              style={{
                height: 'var(--touch-target-min)',
                fontSize: '1.125rem',
                borderRadius: 'var(--radius-lg)',
                borderColor: displayError ? 'var(--color-error)' : 'var(--color-border)',
                backgroundColor: isLoading ? 'var(--color-bg-soft)' : 'white',
                color: 'var(--color-text-primary)',
              }}
              onFocus={(e) => {
                if (!displayError) {
                  e.target.style.borderColor = 'var(--color-primary)';
                }
              }}
              onBlur={(e) => {
                if (!displayError) {
                  e.target.style.borderColor = 'var(--color-border)';
                }
              }}
              placeholder="비밀번호를 입력하세요"
              aria-invalid={!!displayError}
              aria-describedby={displayError ? 'login-error' : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isFormValid) {
                  handleSubmit(e as any);
                }
              }}
            />
          </div>

          {/* Error Message */}
          {displayError && (
            <div
              id="login-error"
              className="mb-6 p-4 rounded-lg flex items-start gap-3"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderLeft: '4px solid var(--color-error)',
              }}
              role="alert"
              aria-live="polite"
            >
              {/* Error Icon */}
              <svg
                className="flex-shrink-0 mt-0.5"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="10" cy="10" r="9" stroke="var(--color-error)" strokeWidth="2" />
                <path d="M10 6V11" stroke="var(--color-error)" strokeWidth="2" strokeLinecap="round" />
                <circle cx="10" cy="14" r="1" fill="var(--color-error)" />
              </svg>

              <p
                className="text-base"
                style={{
                  fontSize: '1rem',
                  color: 'var(--color-error)',
                  fontWeight: 'var(--font-weight-semibold)',
                }}
              >
                {displayError}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <PrimaryButton
            type="submit"
            fullWidth
            size="lg"
            isLoading={isLoading}
            disabled={!isFormValid || isLoading}
            aria-label={isLoading ? '로그인 처리 중' : '로그인'}
          >
            로그인
          </PrimaryButton>
        </form>

        {/* Accessibility Helper Text */}
        <p
          className="mt-6 text-center text-sm"
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-small)',
          }}
        >
          선생님이 만든 계정으로 로그인하세요
        </p>
      </div>

      {/* Footer info */}
      <p
        className="mt-8 text-center"
        style={{
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-small)',
        }}
      >
        꿈꾸는 카메라 프로그램
      </p>
    </div>
  );
}
