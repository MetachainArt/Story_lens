/**
 * @TASK P1-S0-T1 - ConfirmModal Component
 * @SPEC Confirmation modal with confirm/cancel actions
 */
import { useEffect } from 'react';
import { PrimaryButton, SecondaryButton } from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = '확인',
  cancelText = '취소',
}: ConfirmModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 'var(--z-modal-backdrop)' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative bg-white rounded-lg shadow-xl max-w-sm w-full overflow-hidden"
        style={{
          zIndex: 'var(--z-modal)',
          boxShadow: 'var(--shadow-xl)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Content */}
        <div className="p-6">
          {/* Title */}
          <h2
            id="modal-title"
            className="font-semibold mb-3"
            style={{
              fontSize: 'var(--font-size-h3)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)',
            }}
          >
            {title}
          </h2>

          {/* Message */}
          <p
            className="leading-relaxed"
            style={{
              fontSize: 'var(--font-size-base)',
              lineHeight: 'var(--line-height-relaxed)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {message}
          </p>
        </div>

        {/* Actions */}
        <div
          className="flex gap-3 px-6 pb-6"
          style={{ paddingTop: 'var(--space-md)' }}
        >
          <SecondaryButton onClick={onCancel} fullWidth>
            {cancelText}
          </SecondaryButton>
          <PrimaryButton onClick={onConfirm} fullWidth>
            {confirmText}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
