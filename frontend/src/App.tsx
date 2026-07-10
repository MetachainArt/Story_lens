/**
 * @TASK P1-S0-T1 - App Router with AuthGuard
 * @SPEC React Router configuration with authentication guards
 */
import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AuthGuard from '@/components/common/AuthGuard';
import PhotoPrivacyGate from '@/components/common/PhotoPrivacyGate';

// Lazy-loaded pages for code splitting
const LoginPage = lazy(() => import('@/pages/login'));
const HomePage = lazy(() => import('@/pages/home'));
const CameraPage = lazy(() => import('@/pages/camera'));
const SelectPage = lazy(() => import('@/pages/select'));
const EditorPage = lazy(() => import('@/pages/editor'));
const SavedPage = lazy(() => import('@/pages/saved'));
const GalleryPage = lazy(() => import('@/pages/gallery'));
const GalleryDetailPage = lazy(() => import('@/pages/gallery/detail'));
const SessionsPage = lazy(() => import('@/pages/sessions'));
const WritePage = lazy(() => import('@/pages/write'));
const MusicPage = lazy(() => import('@/pages/music'));
const PhotoBookPage = lazy(() => import('@/pages/photobook'));
const StudentsPage = lazy(() => import('@/pages/students'));
const StudentPhotosPage = lazy(() => import('@/pages/students/photos'));
const TemplatesPage = lazy(() => import('@/pages/templates'));
const AiRetouchPage = lazy(() => import('@/pages/ai-retouch'));
const AdminTemplatesPage = lazy(() => import('@/pages/admin/templates'));
const AdminAssetsPage = lazy(() => import('@/pages/admin/assets'));
const AdminPresetsPage = lazy(() => import('@/pages/admin/presets'));
const AdminTemplateUsagePage = lazy(() => import('@/pages/admin/template-usage'));

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

function GlobalManualShortcut() {
  const location = useLocation();

  if (location.pathname !== '/') {
    return null;
  }

  return (
    <a
      href="/manual/index.html"
      target="_blank"
      rel="noreferrer"
      className="story-manual-shortcut"
      aria-label="사용 안내 열기"
    >
      <span className="story-manual-shortcut__icon" aria-hidden="true">📘</span>
      <span className="story-manual-shortcut__label">사용 안내</span>
    </a>
  );
}

function PhotoProcessingRoute({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <PhotoPrivacyGate>{children}</PhotoPrivacyGate>
    </AuthGuard>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}> 
        <GlobalManualShortcut />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/manual" element={<Navigate to="/manual/index.html" replace />} />

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
              <PhotoProcessingRoute>
                <CameraPage />
              </PhotoProcessingRoute>
            }
          />
          <Route
            path="/select"
            element={
              <PhotoProcessingRoute>
                <SelectPage />
              </PhotoProcessingRoute>
            }
          />
          <Route
            path="/templates"
            element={
              <PhotoProcessingRoute>
                <TemplatesPage />
              </PhotoProcessingRoute>
            }
          />
          <Route
            path="/ai-retouch"
            element={
              <PhotoProcessingRoute>
                <AiRetouchPage />
              </PhotoProcessingRoute>
            }
          />
          <Route
            path="/edit/:photoId"
            element={
              <PhotoProcessingRoute>
                <EditorPage />
              </PhotoProcessingRoute>
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
            path="/write/:photoId"
            element={
              <PhotoProcessingRoute>
                <WritePage />
              </PhotoProcessingRoute>
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
          <Route
            path="/gallery/:photoId"
            element={
              <AuthGuard>
                <GalleryDetailPage />
              </AuthGuard>
            }
          />
          <Route
            path="/music/:photoId"
            element={
              <AuthGuard>
                <MusicPage />
              </AuthGuard>
            }
          />
          <Route
            path="/photobook"
            element={
              <AuthGuard>
                <PhotoBookPage />
              </AuthGuard>
            }
          />
          <Route
            path="/sessions"
            element={
              <AuthGuard>
                <SessionsPage />
              </AuthGuard>
            }
          />

          <Route
            path="/students"
            element={
              <AuthGuard>
                <StudentsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/students/:studentId/photos"
            element={
              <AuthGuard>
                <StudentPhotosPage />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/templates"
            element={
              <AuthGuard>
                <AdminTemplatesPage />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/assets"
            element={
              <AuthGuard>
                <AdminAssetsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/presets"
            element={
              <AuthGuard>
                <AdminPresetsPage />
              </AuthGuard>
            }
          />
          <Route
            path="/admin/template-usage"
            element={
              <AuthGuard>
                <AdminTemplateUsagePage />
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
