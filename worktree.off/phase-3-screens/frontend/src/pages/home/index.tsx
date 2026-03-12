/**
 * @TASK P3-S1-T1 - Home Page Implementation
 * @SPEC specs/screens/home.yaml
 * Home screen with greeting, photo taking, gallery access, and logout
 */
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { PrimaryButton, SecondaryButton } from '@/components/common/Button'

export default function HomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleTakePhoto = () => {
    navigate('/camera')
  }

  const handleMyPhotos = () => {
    navigate('/gallery')
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      navigate('/login')
    }
  }

  const userName = user?.name || null
  const greeting = userName ? `안녕하세요, ${userName}님!` : '안녕하세요!'

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        paddingTop: 'var(--space-2xl)',
        paddingBottom: 'var(--space-2xl)',
      }}
    >
      {/* Greeting */}
      <h1
        className="mb-12 text-center"
        style={{
          fontSize: 'var(--font-size-h1)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)',
          marginBottom: 'var(--space-2xl)',
        }}
      >
        {greeting}
      </h1>

      {/* Main Action - Take Photo Button */}
      <div className="w-full max-w-md mb-8">
        <PrimaryButton
          onClick={handleTakePhoto}
          fullWidth
          size="lg"
          className="text-2xl py-8"
          style={{
            height: '120px',
            fontSize: '1.5rem',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle
              cx="12"
              cy="13"
              r="4"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
          </svg>
          <span>사진 찍기</span>
        </PrimaryButton>
      </div>

      {/* Secondary Actions */}
      <div className="w-full max-w-md space-y-4">
        {/* My Photos Button */}
        <SecondaryButton
          onClick={handleMyPhotos}
          fullWidth
          size="lg"
          style={{
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
            <path
              d="M21 15l-5-5L5 21"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span>내 사진 보기</span>
        </SecondaryButton>

        {/* Logout Button */}
        <SecondaryButton
          onClick={handleLogout}
          fullWidth
          size="lg"
          style={{
            borderRadius: 'var(--radius-lg)',
            borderColor: 'var(--color-text-secondary)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="16 17 21 12 16 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1="21"
              y1="12"
              x2="9"
              y2="12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>로그아웃</span>
        </SecondaryButton>
      </div>
    </main>
  )
}
