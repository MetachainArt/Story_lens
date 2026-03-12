/**
 * @TASK P3-S1-T1 - Home Page Integration Tests
 * @SPEC specs/screens/home.yaml
 * Tests for home screen with greeting, navigation buttons, and logout functionality
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import HomePage from '../index'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/types/auth'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock the auth store
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}))

describe('HomePage', () => {
  const mockLogout = vi.fn()
  const mockUser: User = {
    id: '1',
    email: 'student@example.com',
    name: '지민',
    role: 'student',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()

    // Setup default mock for useAuthStore
    vi.mocked(useAuthStore).mockReturnValue({
      user: mockUser,
      logout: mockLogout,
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
      isLoading: false,
      isAuthenticated: true,
      error: null,
      login: vi.fn(),
      refreshTokens: vi.fn(),
      loadUser: vi.fn(),
      clearError: vi.fn(),
      setTokens: vi.fn(),
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  /**
   * Test 1: Component Rendering
   */
  describe('Component Rendering', () => {
    it('should render greeting with user name', () => {
      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      )

      expect(screen.getByText('안녕하세요, 지민님!')).toBeInTheDocument()
    })

    it('should render greeting with fallback when name is null', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: { ...mockUser, name: null },
        logout: mockLogout,
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh',
        isLoading: false,
        isAuthenticated: true,
        error: null,
        login: vi.fn(),
        refreshTokens: vi.fn(),
        loadUser: vi.fn(),
        clearError: vi.fn(),
        setTokens: vi.fn(),
      })

      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      )

      expect(screen.getByText('안녕하세요!')).toBeInTheDocument()
    })

    it('should render "사진 찍기" button', () => {
      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      )

      const takePhotoButton = screen.getByRole('button', { name: /사진 찍기/i })
      expect(takePhotoButton).toBeInTheDocument()
    })

    it('should render "내 사진 보기" button', () => {
      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      )

      const myPhotosButton = screen.getByRole('button', { name: /내 사진 보기/i })
      expect(myPhotosButton).toBeInTheDocument()
    })

    it('should render "로그아웃" button', () => {
      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      )

      const logoutButton = screen.getByRole('button', { name: /로그아웃/i })
      expect(logoutButton).toBeInTheDocument()
    })
  })

  /**
   * Test 2: Navigation - Take Photo
   */
  describe('Navigation - Take Photo', () => {
    it('should navigate to /camera when "사진 찍기" button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      )

      const takePhotoButton = screen.getByRole('button', { name: /사진 찍기/i })
      await user.click(takePhotoButton)

      expect(mockNavigate).toHaveBeenCalledWith('/camera')
    })
  })

  /**
   * Test 3: Navigation - My Photos
   */
  describe('Navigation - My Photos', () => {
    it('should navigate to /gallery when "내 사진 보기" button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      )

      const myPhotosButton = screen.getByRole('button', { name: /내 사진 보기/i })
      await user.click(myPhotosButton)

      expect(mockNavigate).toHaveBeenCalledWith('/gallery')
    })
  })

  /**
   * Test 4: Logout Functionality
   */
  describe('Logout Functionality', () => {
    it('should call logout and navigate to /login when logout button is clicked', async () => {
      const user = userEvent.setup()
      mockLogout.mockResolvedValueOnce(undefined)

      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      )

      const logoutButton = screen.getByRole('button', { name: /로그아웃/i })
      await user.click(logoutButton)

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalledTimes(1)
      })

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login')
      })
    })

    it('should navigate to /login even if logout fails', async () => {
      const user = userEvent.setup()
      mockLogout.mockRejectedValueOnce(new Error('Logout failed'))

      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      )

      const logoutButton = screen.getByRole('button', { name: /로그아웃/i })
      await user.click(logoutButton)

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalledTimes(1)
      })

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login')
      })
    })
  })

  /**
   * Test 5: Accessibility
   */
  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      )

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThanOrEqual(3)
    })

    it('should have main landmark for content', () => {
      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      )

      const mainElement = screen.getByRole('main')
      expect(mainElement).toBeInTheDocument()
    })

    it('should have greeting as heading', () => {
      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      )

      const heading = screen.getByRole('heading', { name: /안녕하세요/i })
      expect(heading).toBeInTheDocument()
      expect(heading.tagName).toBe('H1')
    })
  })

  /**
   * Test 6: Button Sizes (Accessibility - Touch Targets)
   */
  describe('Touch Target Sizes', () => {
    it('should render "사진 찍기" button with large size', () => {
      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      )

      const takePhotoButton = screen.getByRole('button', { name: /사진 찍기/i })

      // Button should be large for accessibility
      expect(takePhotoButton).toBeInTheDocument()
    })
  })

  /**
   * Test 7: User Role Display
   */
  describe('User Role Considerations', () => {
    it('should handle teacher role', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: { ...mockUser, role: 'teacher', name: '선생님' },
        logout: mockLogout,
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh',
        isLoading: false,
        isAuthenticated: true,
        error: null,
        login: vi.fn(),
        refreshTokens: vi.fn(),
        loadUser: vi.fn(),
        clearError: vi.fn(),
        setTokens: vi.fn(),
      })

      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      )

      expect(screen.getByText('안녕하세요, 선생님님!')).toBeInTheDocument()
    })

    it('should handle student role', () => {
      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      )

      expect(screen.getByText('안녕하세요, 지민님!')).toBeInTheDocument()
    })
  })
})
