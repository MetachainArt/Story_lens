/**
 * @TASK P0-T0.1 - App Router Configuration
 * @SPEC docs/planning/07-coding-convention.md
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/camera" element={<CameraPage />} />
        <Route path="/select" element={<SelectPage />} />
        <Route path="/edit/:photoId" element={<EditorPage />} />
        <Route path="/saved" element={<SavedPage />} />
        <Route path="/gallery" element={<GalleryPage />} />

        {/* Catch-all redirect to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
