/**
 * @TASK P1-S1-T2 - Test Setup
 * Vitest global setup file
 */
import '@testing-library/jest-dom'

// Mock localStorage
const localStorageMock: Storage = {
  length: 0,
  key: vi.fn(() => null),
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
})

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: '',
    pathname: '/',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  },
  configurable: true,
})

// Reset mocks before each test
beforeEach(() => {
  localStorageMock.getItem.mockClear()
  localStorageMock.setItem.mockClear()
  localStorageMock.removeItem.mockClear()
  localStorageMock.clear.mockClear()
})
