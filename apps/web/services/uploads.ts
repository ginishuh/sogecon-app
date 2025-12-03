// 파일 업로드 서비스

import { apiFetch } from '../lib/api';

export type ImageUploadResponse = {
  url: string;
  filename: string;
};

export async function uploadImage(file: File): Promise<ImageUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return apiFetch<ImageUploadResponse>('/uploads/images', {
    method: 'POST',
    body: formData,
  });
}
