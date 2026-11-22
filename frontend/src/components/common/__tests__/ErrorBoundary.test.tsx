import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '../ErrorBoundary';

function Broken({ error }: { error: Error }): never {
  throw error;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught render errors; keep the test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its children when nothing fails', () => {
    render(
      <ErrorBoundary>
        <p>정상 화면</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('정상 화면')).toBeInTheDocument();
  });

  it('replaces a crashed screen with a readable recovery message', async () => {
    const onReload = vi.fn();
    render(
      <ErrorBoundary onReload={onReload}>
        <Broken error={new Error('boom')} />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('화면을 보여주지 못했어요');
    expect(alert).not.toHaveTextContent('boom');
    expect(screen.getByRole('link', { name: '처음 화면으로' })).toHaveAttribute('href', '/');

    await userEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('reloads once by itself when a new version replaced the page files', () => {
    const onReload = vi.fn();
    render(
      <ErrorBoundary onReload={onReload}>
        <Broken error={new TypeError('Failed to fetch dynamically imported module: /assets/index-abc.js')} />
      </ErrorBoundary>,
    );

    expect(onReload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('새 버전');
  });

  it('does not reload in a loop when the page files are still missing', () => {
    const onReload = vi.fn();
    const chunkError = new TypeError('Importing a module script failed.');

    const first = render(
      <ErrorBoundary onReload={onReload}>
        <Broken error={chunkError} />
      </ErrorBoundary>,
    );
    first.unmount();
    render(
      <ErrorBoundary onReload={onReload}>
        <Broken error={chunkError} />
      </ErrorBoundary>,
    );

    expect(onReload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '다시 불러오기' })).toBeInTheDocument();
  });
});
