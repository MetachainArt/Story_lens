/**
 * ErrorBoundary - keeps a crashed screen from turning into a blank page.
 *
 * Without a boundary, any render error unmounts the whole app and leaves a
 * white screen with no way forward. The most common trigger in production is
 * a tab that was opened before a deploy: its lazy-loaded page files no longer
 * exist on the server, so the next navigation fails to import them.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

const RELOAD_MARKER_KEY = 'story-lens:reloaded-for-new-version';

const CHUNK_LOAD_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
];

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return CHUNK_LOAD_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/** Remember that we already reloaded, so a still-missing file cannot loop. */
function claimAutomaticReload(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_MARKER_KEY)) return false;
    sessionStorage.setItem(RELOAD_MARKER_KEY, String(Date.now()));
    return true;
  } catch {
    // Storage can be blocked (private mode); never auto-reload without a guard.
    return false;
  }
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Defaults to a full page reload. Injectable for tests. */
  onReload?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  isNewVersion: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, isNewVersion: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, isNewVersion: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Screen crashed', error, info.componentStack);
    if (isChunkLoadError(error) && claimAutomaticReload()) {
      this.reload();
    }
  }

  private reload = (): void => {
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { isNewVersion } = this.state;

    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'var(--color-bg-primary, #FFF5EB)',
        }}
      >
        <div
          role="alert"
          style={{
            width: '100%',
            maxWidth: 420,
            padding: 28,
            borderRadius: 24,
            textAlign: 'center',
            background: 'var(--color-surface, #FFFFFF)',
            border: '1.5px solid var(--color-border, #F0D5B8)',
            color: 'var(--color-text-primary, #4A3728)',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            {isNewVersion ? '새 버전이 준비되었어요' : '화면을 보여주지 못했어요'}
          </h1>
          <p style={{ margin: '12px 0 24px', fontSize: 16, lineHeight: 1.6 }}>
            {isNewVersion
              ? '화면을 다시 불러오면 바로 이어서 쓸 수 있어요.'
              : '잠시 문제가 생겼어요. 다시 불러오면 대부분 해결돼요.'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              type="button"
              onClick={this.reload}
              style={{
                minHeight: 52,
                borderRadius: 16,
                border: 'none',
                fontSize: 17,
                fontWeight: 700,
                cursor: 'pointer',
                color: '#FFFFFF',
                background: 'var(--color-primary, #D4845A)',
              }}
            >
              다시 불러오기
            </button>
            <a
              href="/"
              style={{
                minHeight: 52,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 16,
                fontSize: 16,
                fontWeight: 600,
                textDecoration: 'none',
                color: 'var(--color-text-primary, #4A3728)',
                border: '1.5px solid var(--color-border, #F0D5B8)',
              }}
            >
              처음 화면으로
            </a>
          </div>
        </div>
      </main>
    );
  }
}

export default ErrorBoundary;
