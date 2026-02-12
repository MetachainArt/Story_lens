/**
 * @TASK P1-S0-T1 - App Router with AuthGuard
 * @SPEC React Router configuration with authentication guards
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthGuard from '@/components/common/AuthGuard';

// Lazy-loaded pages for code splitting
const LoginPage = lazy(() => import('@/pages/login'));
const HomePage = lazy(() => import('@/pages/home'));
const CameraPage = lazy(() => import('@/pages/camera'));
const SelectPage = lazy(() => import('@/pages/select'));
const EditorPage = lazy(() => import('@/pages/editor'));
const SavedPage = lazy(() => import('@/pages/saved'));
const GalleryPage = lazy(() => import('@/pages/gallery'));

function LoadingFallback() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FFF5EB',
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: '4px solid #F0D5B8',
        borderTopColor: '#D4845A',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <AuthGuard>
                <HomePage />
              </AuthGuard>
            }
          />
          <Route
            path="/camera"
            element={
              <AuthGuard>
                <CameraPage />
              </AuthGuard>
            }
          />
          <Route
            path="/select"
            element={
              <AuthGuard>
                <SelectPage />
              </AuthGuard>
            }
          />
          <Route
            path="/edit/:photoId"
            element={
              <AuthGuard>
                <EditorPage />
              </AuthGuard>
            }
          />
          <Route
            path="/saved"
            element={
              <AuthGuard>
                <SavedPage />
              </AuthGuard>
            }
          />
          <Route
            path="/gallery"
            element={
              <AuthGuard>
                <GalleryPage />
              </AuthGuard>
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
