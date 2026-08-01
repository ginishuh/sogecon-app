import { notFound } from 'next/navigation';

import { PostDetailContent } from '../../../components/post-detail-content';
import { ApiError } from '../../../lib/api';
import { getPost } from '../../../services/posts';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PostDetailPage({ params }: PageProps) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  try {
    const post = await getPost(id);
    return <PostDetailContent post={post} />;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      notFound();
    }
    throw e;
  }
}
