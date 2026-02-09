/**
 * @TASK P3-S6-T1 - Gallery Page Integration Tests
 * @SPEC specs/screens/gallery.yaml
 * Tests for gallery screen with photo grid, empty state, and navigation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import GalleryPage from '../index'
import api from '@/services/api'
import type { Photo } from '@/types/photo'

// Mock the API client
vi.mock('@/services/api')

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('GalleryPage', () => {
  const mockPhotos: Photo[] = [
    {
      id: '1',
      user_id: 'user-1',
      session_id: 'session-1',
      original_url: 'https://example.com/photo1.jpg',
      edited_url: 'https://example.com/photo1-edited.jpg',
      title: '첫 번째 사진',
      thumbnail_url: 'https://example.com/photo1-thumb.jpg',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:00:00Z',
    },
    {
      id: '2',
      user_id: 'user-1',
      session_id: 'session-1',
      original_url: 'https://example.com/photo2.jpg',
      edited_url: null,
      title: null,
      thumbnail_url: null,
      created_at: '2024-01-02T11:00:00Z',
      updated_at: '2024-01-02T11:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  /**
   * Test 1: Loading State
   */
  describe('Loading State', () => {
    it('should display loading spinner while fetching photos', () => {
      vi.mocked(api.get).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      )

      expect(screen.getByText(/불러오는 중/i)).toBeInTheDocument()
    })
  })

  /**
   * Test 2: Photo Grid Rendering
   */
  describe('Photo Grid Rendering', () => {
    it('should display PageHeader with "내 사진" title', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: mockPhotos,
      })

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('내 사진')).toBeInTheDocument()
      })
    })

    it('should fetch photos from API on mount', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: mockPhotos,
      })

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/v1/photos')
      })
    })

    it('should render photo grid with correct number of photos', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: mockPhotos,
      })

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        const photoCards = screen.getAllByRole('img')
        expect(photoCards).toHaveLength(2)
      })
    })

    it('should use thumbnail_url if available', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: mockPhotos,
      })

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        const firstImage = screen.getAllByRole('img')[0] as HTMLImageElement
        expect(firstImage.src).toContain('photo1-thumb.jpg')
      })
    })

    it('should fallback to edited_url then original_url when thumbnail is missing', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: mockPhotos,
      })

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        const secondImage = screen.getAllByRole('img')[1] as HTMLImageElement
        expect(secondImage.src).toContain('photo2.jpg')
      })
    })
  })

  /**
   * Test 3: Empty State
   */
  describe('Empty State', () => {
    it('should display empty state when no photos exist', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: [],
      })

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/아직 사진이 없어요/i)).toBeInTheDocument()
      })
    })

    it('should show "사진 찍으러 가기" button in empty state', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: [],
      })

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        const cameraButton = screen.getByRole('button', { name: /사진 찍으러 가기/i })
        expect(cameraButton).toBeInTheDocument()
      })
    })

    it('should navigate to /camera when "사진 찍으러 가기" is clicked', async () => {
      const user = userEvent.setup()
      vi.mocked(api.get).mockResolvedValueOnce({
        data: [],
      })

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/아직 사진이 없어요/i)).toBeInTheDocument()
      })

      const cameraButton = screen.getByRole('button', { name: /사진 찍으러 가기/i })
      await user.click(cameraButton)

      expect(mockNavigate).toHaveBeenCalledWith('/camera')
    })
  })

  /**
   * Test 4: Navigation
   */
  describe('Navigation', () => {
    it('should navigate to home when back button is clicked', async () => {
      const user = userEvent.setup()
      vi.mocked(api.get).mockResolvedValueOnce({
        data: mockPhotos,
      })

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('내 사진')).toBeInTheDocument()
      })

      const backButton = screen.getByRole('button', { name: /뒤로 가기/i })
      await user.click(backButton)

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })

    it('should navigate to /edit/:photoId when photo is clicked', async () => {
      const user = userEvent.setup()
      vi.mocked(api.get).mockResolvedValueOnce({
        data: mockPhotos,
      })

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        const photoCards = screen.getAllByRole('img')
        expect(photoCards).toHaveLength(2)
      })

      const firstPhoto = screen.getAllByRole('img')[0].closest('button')
      if (firstPhoto) {
        await user.click(firstPhoto)
      }

      expect(mockNavigate).toHaveBeenCalledWith('/edit/1')
    })
  })

  /**
   * Test 5: Error Handling
   */
  describe('Error Handling', () => {
    it('should display error message when API call fails', async () => {
      vi.mocked(api.get).mockRejectedValueOnce({
        response: {
          status: 500,
          data: { detail: '서버 오류' },
        },
      })

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/사진을 불러올 수 없습니다/i)).toBeInTheDocument()
      })
    })

    it('should show retry button when error occurs', async () => {
      vi.mocked(api.get).mockRejectedValueOnce({
        response: {
          status: 500,
          data: { detail: '서버 오류' },
        },
      })

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /다시 시도/i })
        expect(retryButton).toBeInTheDocument()
      })
    })

    it('should retry fetching photos when retry button is clicked', async () => {
      const user = userEvent.setup()

      // First call fails
      vi.mocked(api.get).mockRejectedValueOnce({
        response: {
          status: 500,
          data: { detail: '서버 오류' },
        },
      })

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/사진을 불러올 수 없습니다/i)).toBeInTheDocument()
      })

      // Second call succeeds
      vi.mocked(api.get).mockResolvedValueOnce({
        data: mockPhotos,
      })

      const retryButton = screen.getByRole('button', { name: /다시 시도/i })
      await user.click(retryButton)

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(2)
        const photoCards = screen.getAllByRole('img')
        expect(photoCards).toHaveLength(2)
      })
    })
  })

  /**
   * Test 6: Accessibility
   */
  describe('Accessibility', () => {
    it('should have proper heading structure', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: mockPhotos,
      })

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        const heading = screen.getByRole('heading', { name: /내 사진/i })
        expect(heading).toBeInTheDocument()
      })
    })

    it('should have alt text for photo images', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: mockPhotos,
      })

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        const images = screen.getAllByRole('img')
        images.forEach((img) => {
          expect(img).toHaveAttribute('alt')
        })
      })
    })
  })

  /**
   * Test 7: Date Formatting
   */
  describe('Date Display', () => {
    it('should format and display photo dates', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: mockPhotos,
      })

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      )

      await waitFor(() => {
        // Should display formatted dates (e.g., "2024.01.01")
        expect(screen.getByText(/2024\.01\.01/)).toBeInTheDocument()
        expect(screen.getByText(/2024\.01\.02/)).toBeInTheDocument()
      })
    })
  })
})
