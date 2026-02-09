/**
 * @TASK P3-S5-T1 - Saved Page Integration Tests
 * @SPEC specs/screens/saved.yaml
 * Tests for save complete screen with preview and navigation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter, useLocation } from 'react-router-dom'
import SavedPage from '../index'
import { useEditorStore } from '@/stores/editor'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: vi.fn(),
  }
})

// Mock the editor store
vi.mock('@/stores/editor', () => ({
  useEditorStore: vi.fn(),
}))

describe('SavedPage', () => {
  const mockPhotoId = 'photo-123'
  const mockEditedUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...'
  const mockOriginalUrl = 'https://example.com/photos/photo-123.jpg'

  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()

    // Setup default mock for useEditorStore
    vi.mocked(useEditorStore).mockReturnValue({
      photoId: mockPhotoId,
      originalUrl: mockOriginalUrl,
      selectedFilter: 'vintage',
      filterCss: 'sepia(0.5)',
      adjustments: {
        brightness: 10,
        contrast: 5,
        saturation: 0,
        temperature: 0,
        sharpness: 0,
      },
      rotation: 0,
      flipX: false,
      activeTab: 'filter',
      setPhotoId: vi.fn(),
      setOriginalUrl: vi.fn(),
      setFilter: vi.fn(),
      setAdjustment: vi.fn(),
      setRotation: vi.fn(),
      setFlipX: vi.fn(),
      setActiveTab: vi.fn(),
      reset: vi.fn(),
      getComputedFilterCss: vi.fn().mockReturnValue('sepia(0.5)'),
      getComputedTransform: vi.fn().mockReturnValue(''),
    })

    // Setup default mock for useLocation
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/saved',
      search: '',
      hash: '',
      state: {
        photoId: mockPhotoId,
        editedUrl: mockEditedUrl,
      },
      key: 'default',
    })
  })

  /**
   * Test 1: Component Rendering
   */
  describe('Component Rendering', () => {
    it('should render success message', () => {
      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      expect(screen.getByText('저장 완료!')).toBeInTheDocument()
    })

    it('should render success icon', () => {
      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      // Check for success icon (checkmark SVG or icon element)
      const successElement = screen.getByTestId('success-icon')
      expect(successElement).toBeInTheDocument()
    })

    it('should render photo preview with edited image', () => {
      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      const photoPreview = screen.getByAltText('편집된 사진')
      expect(photoPreview).toBeInTheDocument()
      expect(photoPreview).toHaveAttribute('src', mockEditedUrl)
    })

    it('should render "홈으로" button', () => {
      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      const homeButton = screen.getByRole('button', { name: /홈으로/i })
      expect(homeButton).toBeInTheDocument()
    })

    it('should render "다시 편집" button', () => {
      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      const reEditButton = screen.getByRole('button', { name: /다시 편집/i })
      expect(reEditButton).toBeInTheDocument()
    })
  })

  /**
   * Test 2: Navigation - Home
   */
  describe('Navigation - Home', () => {
    it('should navigate to / when "홈으로" button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      const homeButton = screen.getByRole('button', { name: /홈으로/i })
      await user.click(homeButton)

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  /**
   * Test 3: Navigation - Re-edit
   */
  describe('Navigation - Re-edit', () => {
    it('should navigate to /edit/:photoId when "다시 편집" button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      const reEditButton = screen.getByRole('button', { name: /다시 편집/i })
      await user.click(reEditButton)

      expect(mockNavigate).toHaveBeenCalledWith(`/edit/${mockPhotoId}`)
    })
  })

  /**
   * Test 4: Data Source - Location State
   */
  describe('Data Source - Location State', () => {
    it('should use editedUrl from location state if available', () => {
      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      const photoPreview = screen.getByAltText('편집된 사진')
      expect(photoPreview).toHaveAttribute('src', mockEditedUrl)
    })

    it('should fallback to originalUrl from editor store if no location state', () => {
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/saved',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      })

      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      const photoPreview = screen.getByAltText('편집된 사진')
      expect(photoPreview).toHaveAttribute('src', mockOriginalUrl)
    })
  })

  /**
   * Test 5: Data Source - Editor Store
   */
  describe('Data Source - Editor Store', () => {
    it('should use photoId from location state if available', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      const reEditButton = screen.getByRole('button', { name: /다시 편집/i })
      await user.click(reEditButton)

      expect(mockNavigate).toHaveBeenCalledWith(`/edit/${mockPhotoId}`)
    })

    it('should use photoId from editor store if no location state', async () => {
      const user = userEvent.setup()
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/saved',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      })

      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      const reEditButton = screen.getByRole('button', { name: /다시 편집/i })
      await user.click(reEditButton)

      expect(mockNavigate).toHaveBeenCalledWith(`/edit/${mockPhotoId}`)
    })
  })

  /**
   * Test 6: Fallback Handling
   */
  describe('Fallback Handling', () => {
    it('should show fallback message when no photo data is available', () => {
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/saved',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      })

      vi.mocked(useEditorStore).mockReturnValue({
        photoId: null,
        originalUrl: null,
        selectedFilter: null,
        filterCss: '',
        adjustments: {
          brightness: 0,
          contrast: 0,
          saturation: 0,
          temperature: 0,
          sharpness: 0,
        },
        rotation: 0,
        flipX: false,
        activeTab: 'filter',
        setPhotoId: vi.fn(),
        setOriginalUrl: vi.fn(),
        setFilter: vi.fn(),
        setAdjustment: vi.fn(),
        setRotation: vi.fn(),
        setFlipX: vi.fn(),
        setActiveTab: vi.fn(),
        reset: vi.fn(),
        getComputedFilterCss: vi.fn().mockReturnValue(''),
        getComputedTransform: vi.fn().mockReturnValue(''),
      })

      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      expect(screen.getByText('저장 완료!')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /홈으로/i })).toBeInTheDocument()
    })

    it('should disable "다시 편집" button when no photoId available', () => {
      vi.mocked(useLocation).mockReturnValue({
        pathname: '/saved',
        search: '',
        hash: '',
        state: null,
        key: 'default',
      })

      vi.mocked(useEditorStore).mockReturnValue({
        photoId: null,
        originalUrl: null,
        selectedFilter: null,
        filterCss: '',
        adjustments: {
          brightness: 0,
          contrast: 0,
          saturation: 0,
          temperature: 0,
          sharpness: 0,
        },
        rotation: 0,
        flipX: false,
        activeTab: 'filter',
        setPhotoId: vi.fn(),
        setOriginalUrl: vi.fn(),
        setFilter: vi.fn(),
        setAdjustment: vi.fn(),
        setRotation: vi.fn(),
        setFlipX: vi.fn(),
        setActiveTab: vi.fn(),
        reset: vi.fn(),
        getComputedFilterCss: vi.fn().mockReturnValue(''),
        getComputedTransform: vi.fn().mockReturnValue(''),
      })

      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      const reEditButton = screen.getByRole('button', { name: /다시 편집/i })
      expect(reEditButton).toBeDisabled()
    })
  })

  /**
   * Test 7: Accessibility
   */
  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThanOrEqual(2)
    })

    it('should have success message as heading', () => {
      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      const heading = screen.getByRole('heading', { name: /저장 완료/i })
      expect(heading).toBeInTheDocument()
    })

    it('should have alt text for photo preview', () => {
      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      const photoPreview = screen.getByAltText('편집된 사진')
      expect(photoPreview).toBeInTheDocument()
    })

    it('should have main landmark', () => {
      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      const mainElement = screen.getByRole('main')
      expect(mainElement).toBeInTheDocument()
    })
  })

  /**
   * Test 8: Visual Design
   */
  describe('Visual Design', () => {
    it('should render with bright and positive styling', () => {
      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      const successMessage = screen.getByText('저장 완료!')
      expect(successMessage).toHaveClass('text-success')
    })

    it('should render photo with rounded corners', () => {
      render(
        <BrowserRouter>
          <SavedPage />
        </BrowserRouter>
      )

      const photoPreview = screen.getByAltText('편집된 사진')
      expect(photoPreview).toHaveClass('rounded-lg')
    })
  })
})
