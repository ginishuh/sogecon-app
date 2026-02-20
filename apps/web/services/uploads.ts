// 파일 업로드 서비스

import { apiFetch } from '../lib/api';
import type { Schema } from './_dto';

export type ImageUploadResponse = Schema<'ImageUploadResponse'>;

export async function uploadImage(file: File): Promise<ImageUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return apiFetch<ImageUploadResponse>('/uploads/images', {
    method: 'POST',
    body: formData,
  });
}
