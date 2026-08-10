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

/** 업로드 URL에서 서버 파일명을 추출한다. */
export function filenameFromUploadUrl(url: string): string | null {
  const marker = '/media/images/';
  const index = url.indexOf(marker);
  if (index < 0) {
    return null;
  }
  const filename = url.slice(index + marker.length).split('?')[0];
  return filename || null;
}

/** 본인 소유 업로드 이미지를 서버에서 삭제한다 (idempotent). */
export async function deleteUpload(filename: string): Promise<void> {
  await apiFetch<void>(`/uploads/images/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
}
