/**
 * @TASK P3-S5-T1 - Saved Page Implementation
 * @SPEC specs/screens/saved.yaml
 * Save complete screen with success message, photo preview, and navigation buttons
 */
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PrimaryButton, SecondaryButton } from '@/components/common/Button';
import { useEditorStore } from '@/stores/editor';

interface LocationState {
  photoId?: string;
  editedUrl?: string;
}

export default function SavedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { photoId: storePhotoId, originalUrl } = useEditorStore();

  // Get data from location state or editor store
  const locationState = location.state as LocationState | null;
  const photoId = locationState?.photoId || storePhotoId;
  const imageUrl = locationState?.editedUrl || originalUrl;

  const handleGoHome = () => {
    navigate('/');
  };

  const handleReEdit = () => {
    if (photoId) {
      navigate(`/edit/${photoId}`);
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
      }}
    >
      <motion.div
        className="max-w-2xl w-full text-center"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Success Icon & Message */}
        <motion.div variants={itemVariants} className="mb-8">
          {/* Success Check Icon */}
          <div
            data-testid="success-icon"
            className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: 'var(--color-success)',
            }}
          >
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1
            className="text-success"
            style={{
              fontSize: 'var(--font-size-h1)',
              fontWeight: 'var(--font-weight-bold)',
              marginBottom: 'var(--space-md)',
            }}
          >
            저장 완료!
          </h1>

          <p
            className="text-text-secondary"
            style={{
              fontSize: 'var(--font-size-body)',
            }}
          >
            사진이 성공적으로 저장되었습니다.
          </p>
        </motion.div>

        {/* Photo Preview */}
        {imageUrl && (
          <motion.div variants={itemVariants} className="mb-8">
            <div
              className="max-w-md mx-auto overflow-hidden"
              style={{
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <img
                src={imageUrl}
                alt="편집된 사진"
                className="w-full h-auto rounded-lg"
                style={{
                  maxHeight: '60vh',
                  objectFit: 'contain',
                }}
              />
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto"
        >
          <PrimaryButton
            onClick={handleGoHome}
            size="lg"
            className="flex-1"
          >
            홈으로
          </PrimaryButton>

          <SecondaryButton
            onClick={handleReEdit}
            disabled={!photoId}
            size="lg"
            className="flex-1"
          >
            다시 편집
          </SecondaryButton>
        </motion.div>
      </motion.div>
    </main>
  );
}
