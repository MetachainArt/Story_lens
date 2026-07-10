import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';


interface PrivacyStatus {
  policy_version: string;
  consent_required: boolean;
  consented_at: string | null;
  retention_days: number;
}

interface PhotoPrivacyGateProps {
  children: ReactNode;
}

export default function PhotoPrivacyGate({ children }: PhotoPrivacyGateProps) {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const [privacy, setPrivacy] = useState<PrivacyStatus | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    setError('');
    try {
      const response = await api.get<PrivacyStatus>('/api/v1/users/me/privacy-status');
      setPrivacy(response.data);
    } catch {
      setError('개인정보 안내를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const accept = async () => {
    if (!isChecked || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      const response = await api.post<PrivacyStatus>(
        '/api/v1/users/me/privacy-consent',
        { accepted: true },
      );
      setPrivacy(response.data);
    } catch {
      setError('동의 내용을 저장하지 못했어요. 다시 눌러 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const leave = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (privacy && !privacy.consent_required) {
    return <>{children}</>;
  }

  return (
    <main className="privacy-gate-page">
      <section className="privacy-gate-panel" aria-labelledby="privacy-gate-title">
        <span className="privacy-gate-icon" aria-hidden="true">🔒</span>
        <p className="privacy-gate-kicker">사진을 안전하게 다룰게요</p>
        <h1 id="privacy-gate-title">사진 저장과 AI 처리 안내</h1>

        {!privacy && !error && (
          <p className="privacy-gate-status" role="status">안내를 불러오고 있어요...</p>
        )}

        {privacy && (
          <>
            <div className="privacy-gate-summary">
              <p>사진은 편집과 선택한 AI 기능을 실행할 때만 사용해요.</p>
              <p>AI 기능을 선택하면 사진이 설정된 AI 제공자에게 암호화되어 전송돼요.</p>
              <p>사진 주소는 로그인한 사용자만 열 수 있어요.</p>
              <p>
                새로 저장하는 사진은 기본 {privacy.retention_days}일 뒤 자동으로 삭제돼요.
                보관함에서 언제든 먼저 삭제할 수 있어요.
              </p>
            </div>

            <label className="privacy-gate-check">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(event) => setIsChecked(event.target.checked)}
              />
              <span>위 내용을 확인했고 사진 저장과 AI 처리에 동의합니다.</span>
            </label>

            <button
              type="button"
              className="privacy-gate-primary"
              disabled={!isChecked || isSaving}
              onClick={accept}
            >
              {isSaving ? '저장하고 있어요...' : '동의하고 계속하기'}
            </button>
          </>
        )}

        {error && <p className="privacy-gate-error" role="alert">{error}</p>}
        {error && (
          <button type="button" className="privacy-gate-secondary" onClick={loadStatus}>
            다시 시도
          </button>
        )}
        <button type="button" className="privacy-gate-link" onClick={leave}>
          동의하지 않고 로그아웃
        </button>
      </section>
    </main>
  );
}
