/**
 * @TASK P1-S0-T1 - App Router with AuthGuard
 * @SPEC React Router configuration with authentication guards
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthGuard from '@/components/common/AuthGuard';
import LoginPage from '@/pages/login';
import HomePage from '@/pages/home';
import CameraPage from '@/pages/camera';
import SelectPage from '@/pages/select';
import EditorPage from '@/pages/editor';
import SavedPage from '@/pages/saved';
import GalleryPage from '@/pages/gallery';

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
