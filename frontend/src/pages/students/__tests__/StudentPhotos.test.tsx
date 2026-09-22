import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import StudentPhotosPage from '../photos';
import api from '@/services/api';
vi.mock('@/services/api', () => ({ default: { get: vi.fn() } }));
it('shows student photos beyond the first page and retains the student filter', async () => {
  vi.mocked(api.get).mockImplementation(async (url, config) => {
    if (url === '/api/v1/users') return { data: [{ id: 'student-1', name: '학생' }] };
    return { data: config?.params?.offset === 50
      ? { items: [{ id: 'last', title: '마지막 사진', original_url: '/uploads/photos/u/last.jpg', created_at: '2026-09-22' }], next_offset: null }
      : { items: [], next_offset: 50 } };
  });
  render(<MemoryRouter initialEntries={['/students/student-1/photos']}><Routes><Route path="/students/:studentId/photos" element={<StudentPhotosPage />} /></Routes></MemoryRouter>);
  expect(await screen.findByAltText('마지막 사진')).toBeInTheDocument();
  expect(api.get).toHaveBeenLastCalledWith('/api/v1/photos/page', { params: { student_id: 'student-1', offset: 50, limit: 50 } });
});
