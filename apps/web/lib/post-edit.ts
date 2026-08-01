import type { PostFormData } from '../components/post-form';
import { isBoardCategory } from './community';
import type {
  BoardPostOwnerUpdatePayload,
  Post,
  UpdatePostPayload,
} from '../services/posts';

function buildNonBoardAdminFields(
  data: PostFormData,
  post: Pick<Post, 'category' | 'published_at'> | undefined,
): UpdatePostPayload {
  const payload: UpdatePostPayload = { pinned: data.pinned };

  // legacy hero는 notice/news 전용 폼의 category로 덮어쓰지 않는다.
  if (post && post.category !== 'hero') {
    payload.category = data.category;
  }

  const wasPublished = !!post?.published_at;
  if (wasPublished && !data.published) {
    payload.unpublish = true;
  } else if (!wasPublished && data.published) {
    payload.published_at = new Date().toISOString();
  }
  return payload;
}

function buildAdminPostFields(
  data: PostFormData,
  post: Pick<Post, 'category' | 'published_at'> | undefined,
): UpdatePostPayload {
  // board 글은 published_at과 무관하게 공개이므로 공개 상태 mutation을 만들지 않는다.
  if (post && isBoardCategory(post.category)) {
    return { pinned: data.pinned };
  }
  return buildNonBoardAdminFields(data, post);
}

export function buildPostUpdatePayload(
  data: PostFormData,
  post: Pick<Post, 'category' | 'published_at'> | undefined,
  isAdmin: boolean,
): UpdatePostPayload {
  const payload: UpdatePostPayload = {
    title: data.title,
    content: data.content,
    cover_image: data.cover_image ?? undefined,
    images: data.images.length > 0 ? data.images : undefined,
  };
  if (isAdmin) {
    Object.assign(payload, buildAdminPostFields(data, post));
  }
  return payload;
}

export function buildBoardPostOwnerUpdatePayload(
  data: PostFormData,
): BoardPostOwnerUpdatePayload {
  return {
    title: data.title,
    content: data.content,
    cover_image: data.cover_image,
    images: data.images,
  };
}
