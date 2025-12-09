import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PostAdminActions } from '../../../components/post-admin-actions';
import { ApiError } from '../../../lib/api';
import { getPost } from '../../../services/posts';

type PageProps = {
  params: Promise<{ id: string }>;
};

type PostHeaderProps = {
  category?: string | null;
  pinned?: boolean;
  title: string;
  authorName?: string | null;
  publishedAt?: string | null;
  viewCount?: number;
};

/** 게시글 헤더 컴포넌트 */
function PostHeader({ category, pinned, title, authorName, publishedAt, viewCount }: PostHeaderProps) {
  return (
    <header className="space-y-2">
      <div className="flex items-center gap-2">
        {category && (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {category}
          </span>
        )}
        {pinned && (
          <span className="text-amber-600" title="상단 고정">
            📌
          </span>
        )}
      </div>
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <div className="flex items-center gap-3 text-sm text-slate-500">
        {authorName && <span>{authorName}</span>}
        {publishedAt && (
          <time dateTime={publishedAt}>
            {new Date(publishedAt).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
        )}
        {viewCount != null && viewCount > 0 && <span>조회 {viewCount}</span>}
      </div>
    </header>
  );
}

/** 이미지 갤러리 컴포넌트 */
function ImageGallery({ coverImage, images }: { coverImage?: string | null; images?: string[] | null }) {
  // 모든 이미지 수집 (커버 + 추가 이미지, 중복 제거)
  const allImages: string[] = [];
  if (coverImage) allImages.push(coverImage);
  if (images) {
    for (const img of images) {
      if (!allImages.includes(img)) {
        allImages.push(img);
      }
    }
  }

  // 첫 번째 이미지 추출 (타입 가드)
  const firstImage = allImages[0];
  if (!firstImage) return null;

  // 이미지가 1장이면 단일 이미지로 표시
  if (allImages.length === 1) {
    return (
      <Image
        src={firstImage}
        alt="게시글 이미지"
        width={720}
        height={405}
        sizes="(max-width: 768px) 100vw, 720px"
        className="h-auto w-full rounded-lg object-cover"
      />
    );
  }

  // 여러 장이면 갤러리로 표시
  return (
    <div className="space-y-3">
      {/* 메인 이미지 (첫 번째) */}
      <Image
        src={firstImage}
        alt="메인 이미지"
        width={720}
        height={405}
        sizes="(max-width: 768px) 100vw, 720px"
        className="h-auto w-full rounded-lg object-cover"
      />
      {/* 추가 이미지 그리드 */}
      {allImages.length > 1 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {allImages.slice(1).map((img, idx) => (
            <div key={img} className="relative aspect-square overflow-hidden rounded-lg">
              <Image
                src={img}
                alt={`이미지 ${idx + 2}`}
                fill
                sizes="(max-width: 640px) 33vw, 25vw"
                className="object-cover hover:scale-105 transition-transform cursor-pointer"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function PostDetailPage({ params }: PageProps) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  try {
    const post = await getPost(id);
    return (
      <article className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <Link href="/posts" className="text-sm text-slate-600 hover:underline">
            ← 목록으로 돌아가기
          </Link>
          <PostAdminActions postId={post.id} postTitle={post.title} />
        </div>

        <PostHeader
          category={post.category}
          pinned={post.pinned}
          title={post.title}
          authorName={post.author_name}
          publishedAt={post.published_at}
          viewCount={post.view_count}
        />

        {/* 이미지 갤러리 */}
        <ImageGallery coverImage={post.cover_image} images={post.images} />

        {/* 본문 */}
        <div className="whitespace-pre-wrap text-base leading-relaxed text-slate-800">
          {post.content}
        </div>
      </article>
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      notFound();
    }
    throw e;
  }
}
