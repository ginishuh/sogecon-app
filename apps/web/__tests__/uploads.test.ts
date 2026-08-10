import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../lib/api';
import { deleteUpload, filenameFromUploadUrl } from '../services/uploads';

describe('uploads service', () => {
  it('filenameFromUploadUrl extracts server filename', () => {
    expect(
      filenameFromUploadUrl('https://api.example.com/media/images/1700000000_abcd1234.jpg'),
    ).toBe('1700000000_abcd1234.jpg');
    expect(filenameFromUploadUrl('/media/images/foo.webp?v=1')).toBe('foo.webp');
    expect(filenameFromUploadUrl('/media/avatars/member_1.jpg')).toBeNull();
  });

  it('deleteUpload calls DELETE endpoint', async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);

    await deleteUpload('1700000000_abcd1234.jpg');

    expect(apiFetch).toHaveBeenCalledWith(
      '/uploads/images/1700000000_abcd1234.jpg',
      { method: 'DELETE' },
    );
  });
});
