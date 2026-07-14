"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import type { KeyboardEvent } from 'react';
import { useMemo, useState } from 'react';

import { ConfirmDialog } from '../../../components/confirm-dialog';
import { AdminAuthState } from '../../../components/admin-auth-state';
import { HeroTargetToggle } from '../../../components/hero-target-toggle';
import { RequirePermission } from '../../../components/require-permission';
import { useToast } from '../../../components/toast';
import { ButtonLink } from '../../../components/ui/button-link';
import { useAuth } from '../../../hooks/useAuth';
import { useHeroTargetControls } from '../../../hooks/useHeroTargetControls';
import { ApiError } from '../../../lib/api';
import { apiErrorToMessage } from '../../../lib/error-map';
import { hasPermissionSession } from '../../../lib/rbac';
import type { HeroTargetLookupItem } from '../../../services/hero';
import {
  deletePost,
  listAdminPosts,
  type Post,
  type AdminPostListParams,
} from '../../../services/posts';

const PAGE_SIZE = 20;

function adminPostsDescription(canManageHero: boolean) {
  return canManageHero
    ? '홈 배너는 목록의 “홈 배너” 토글로 지정합니다.'
    : '공지와 동문 소식을 작성하고 관리합니다.';
}

/* ─────────────────────────────────────────────────────────────────────────
   Sub-components (complexity isolation)
───────────────────────────────────────────────────────────────────────── */

function StatusBadge({ published }: { published: boolean }) {
  if (published) {
    return (
      <span className="inline-flex items-center rounded-full bg-state-success-subtle px-2 py-0.5 text-xs font-medium text-state-success ring-1 ring-state-success-ring">
        공개
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-neutral-subtle px-2 py-0.5 text-xs font-medium text-text-secondary ring-1 ring-neutral-border">
      비공개
    </span>
  );
}

function CategoryBadge({ category }: { category: string | null | undefined }) {
  const labels: Record<string, string> = {
    notice: '공지',
    news: '소식',
    hero: '히어로(구)',
  };
  const label = category ? labels[category] ?? category : '-';
  return <span className="text-xs text-text-muted">{label}</span>;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

type FilterBarProps = {
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  searchInput: string;
  onSearchInputChange: (v: string) => void;
  onSearch: () => void;
  onRefresh: () => void;
};

function FilterBar({
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  searchInput,
  onSearchInputChange,
  onSearch,
  onRefresh,
}: FilterBarProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSearch();
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <select
        className="rounded border border-neutral-border px-3 py-1.5 text-sm"
        value={categoryFilter}
        onChange={(e) => onCategoryChange(e.target.value)}
      >
        <option value="">전체 카테고리</option>
        <option value="notice">공지</option>
        <option value="news">소식</option>
      </select>

      <select
        className="rounded border border-neutral-border px-3 py-1.5 text-sm"
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
      >
        <option value="">전체 상태</option>
        <option value="published">공개</option>
        <option value="draft">비공개</option>
      </select>

      <div className="flex">
        <input
          type="text"
          className="rounded-l border border-r-0 border-neutral-border px-3 py-1.5 text-sm"
          placeholder="검색어"
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="rounded-r border border-neutral-border bg-surface-raised px-3 py-1.5 text-sm hover:bg-surface-raised"
          onClick={onSearch}
        >
          검색
        </button>
      </div>

      <button
        type="button"
        className="rounded border border-neutral-border px-3 py-1.5 text-sm hover:bg-surface-raised"
        onClick={onRefresh}
      >
        새로고침
      </button>
    </div>
  );
}

type PostTableRowProps = {
  post: Post;
  canManageHero: boolean;
  heroItem?: HeroTargetLookupItem;
  heroPending: boolean;
  onDelete: (post: Post) => void;
  onToggleHero: (nextOn: boolean) => void;
  onTogglePinned: (nextPinned: boolean) => void;
};

function PostTableRow({
  post,
  canManageHero,
  heroItem,
  heroPending,
  onDelete,
  onToggleHero,
  onTogglePinned,
}: PostTableRowProps) {
  return (
    <tr className="border-b hover:bg-surface-raised">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {post.pinned && <span title="고정됨">📌</span>}
          <Link
            href={`/posts/${post.id}`}
            className="font-medium text-text-primary hover:underline"
          >
            {post.title}
          </Link>
        </div>
        {post.author_name && (
          <div className="text-xs text-text-muted">{post.author_name}</div>
        )}
      </td>
      <td className="px-3 py-2">
        <CategoryBadge category={post.category} />
      </td>
      <td className="px-3 py-2">
        <StatusBadge published={!!post.published_at} />
      </td>
      <td className="px-3 py-2 text-text-secondary">{post.view_count ?? 0}</td>
      <td className="px-3 py-2 text-text-secondary">{post.comment_count ?? 0}</td>
      <td className="px-3 py-2 text-text-secondary">{formatDate(post.published_at ?? null)}</td>
      {canManageHero && (
        <td className="px-3 py-2">
          <HeroTargetToggle
            value={heroItem}
            isPending={heroPending}
            onToggle={onToggleHero}
            onTogglePinned={onTogglePinned}
          />
        </td>
      )}
      <td className="px-3 py-2 text-right">
        <Link
          href={`/admin/posts/${post.id}/edit`}
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          수정
        </Link>
        <span className="mx-1 text-neutral-border">|</span>
        <button
          type="button"
          className="text-sm text-state-error hover:text-state-error-hover"
          onClick={() => onDelete(post)}
        >
          삭제
        </button>
      </td>
    </tr>
  );
}

type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
};

function Pagination({ page, totalPages, total, onPrev, onNext }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="text-sm text-text-secondary">총 {total}건</div>
      <div className="flex gap-1">
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          disabled={page === 0}
          onClick={onPrev}
        >
          이전
        </button>
        <span className="px-3 py-1 text-sm">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          disabled={page >= totalPages - 1}
          onClick={onNext}
        >
          다음
        </button>
      </div>
    </div>
  );
}

type PostTableContentProps = {
  isLoading: boolean;
  isError: boolean;
  items: Post[] | undefined;
  canManageHero: boolean;
  heroById: Map<number, HeroTargetLookupItem>;
  heroPending: boolean;
  onToggleHeroFor: (post: Post, nextOn: boolean) => void;
  onTogglePinnedFor: (post: Post, nextPinned: boolean) => void;
  totalPages: number;
  total: number;
  page: number;
  onDelete: (post: Post) => void;
  onPrev: () => void;
  onNext: () => void;
};

function PostTableContent({
  isLoading,
  isError,
  items,
  canManageHero,
  heroById,
  heroPending,
  onToggleHeroFor,
  onTogglePinnedFor,
  totalPages,
  total,
  page,
  onDelete,
  onPrev,
  onNext,
}: PostTableContentProps) {
  if (isLoading) {
    return <div className="py-8 text-center text-sm text-text-muted">로딩 중...</div>;
  }
  if (isError) {
    return (
      <div className="py-8 text-center text-sm text-state-error">
        데이터를 불러올 수 없습니다.
      </div>
    );
  }
  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-surface-raised">
              <th className="px-3 py-2 font-medium text-text-secondary">제목</th>
              <th className="px-3 py-2 font-medium text-text-secondary">카테고리</th>
              <th className="px-3 py-2 font-medium text-text-secondary">상태</th>
              <th className="px-3 py-2 font-medium text-text-secondary">조회</th>
              <th className="px-3 py-2 font-medium text-text-secondary">댓글</th>
              <th className="px-3 py-2 font-medium text-text-secondary">발행일</th>
              {canManageHero && (
                <th className="px-3 py-2 font-medium text-text-secondary">홈 배너</th>
              )}
              <th className="px-3 py-2 text-right font-medium text-text-secondary">액션</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((post) => (
              <PostTableRow
                key={post.id}
                post={post}
                canManageHero={canManageHero}
                heroItem={heroById.get(post.id)}
                heroPending={heroPending}
                onDelete={onDelete}
                onToggleHero={(nextOn) => onToggleHeroFor(post, nextOn)}
                onTogglePinned={(nextPinned) => onTogglePinnedFor(post, nextPinned)}
              />
            ))}
            {items?.length === 0 && (
              <tr>
                <td colSpan={canManageHero ? 8 : 7} className="px-3 py-8 text-center text-text-muted">
                  게시물이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPrev={onPrev}
        onNext={onNext}
      />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Custom Hooks (complexity isolation)
───────────────────────────────────────────────────────────────────────── */

function useDeleteMutation(
  onSuccessCallback: () => void,
  showToast: (msg: string, opts: { type: 'success' | 'error' }) => void
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deletePost(id),
    onSuccess: () => {
      showToast('게시물이 삭제되었습니다.', { type: 'success' });
      onSuccessCallback();
      void queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
    },
    onError: (e: unknown) => {
      const msg =
        e instanceof ApiError
          ? apiErrorToMessage(e.code, e.message)
          : '삭제 중 오류가 발생했습니다.';
      showToast(msg, { type: 'error' });
    },
  });
}

function useFilters() {
  const [page, setPage] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const resetPage = () => setPage(0);

  const handleSearch = () => {
    setSearchQuery(searchInput);
    resetPage();
  };

  const handleCategoryChange = (v: string) => {
    setCategoryFilter(v);
    resetPage();
  };

  const handleStatusChange = (v: string) => {
    setStatusFilter(v);
    resetPage();
  };

  const params: AdminPostListParams = {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    category: categoryFilter || undefined,
    status: (statusFilter as 'published' | 'draft') || undefined,
    q: searchQuery || undefined,
  };

  return {
    page,
    setPage,
    categoryFilter,
    statusFilter,
    searchInput,
    setSearchInput,
    params,
    handleSearch,
    handleCategoryChange,
    handleStatusChange,
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   Main Page Component
───────────────────────────────────────────────────────────────────────── */

export default function AdminPostsPage() {
  const { status, data: session } = useAuth();
  const { show } = useToast();
  const filters = useFilters();
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const canManagePosts = hasPermissionSession(session, 'admin_posts');
  const canManageHero = hasPermissionSession(session, 'admin_hero');

  const clearDeleteTarget = () => setDeleteTarget(null);
  const deleteMutation = useDeleteMutation(clearDeleteTarget, show);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-posts', filters.params],
    queryFn: () => listAdminPosts(filters.params),
    enabled: canManagePosts,
    staleTime: 30_000,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const postIds = useMemo(() => data?.items.map((post) => post.id) ?? [], [data?.items]);
  const heroControls = useHeroTargetControls({
    targetType: 'post',
    targetIds: postIds,
    showToast: show,
    enabled: canManageHero,
  });

  if (status !== 'authorized') {
    return <AdminAuthState status={status} />;
  }

  return (
    <RequirePermission
      permission="admin_posts"
      fallback={<div className="p-6 text-sm text-text-secondary">해당 화면 접근 권한이 없습니다.</div>}
    >
      <div className="p-6">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">게시물 관리</h2>
            <p className="text-sm text-text-secondary">
              {adminPostsDescription(canManageHero)}
            </p>
          </div>
          <ButtonLink href="/admin/posts/new" className="shadow-sm">
            + 새 글 작성
          </ButtonLink>
        </div>

        {/* 필터 */}
        <FilterBar
          categoryFilter={filters.categoryFilter}
          onCategoryChange={filters.handleCategoryChange}
          statusFilter={filters.statusFilter}
          onStatusChange={filters.handleStatusChange}
          searchInput={filters.searchInput}
          onSearchInputChange={filters.setSearchInput}
          onSearch={filters.handleSearch}
          onRefresh={() => void refetch()}
        />

        {/* 테이블 */}
        <PostTableContent
          isLoading={isLoading}
          isError={isError}
          items={data?.items}
          canManageHero={canManageHero}
          heroById={heroControls.heroById}
          heroPending={heroControls.isPending}
          onToggleHeroFor={(post, nextOn) => heroControls.toggleHero(post.id, nextOn)}
          onTogglePinnedFor={(post, nextPinned) => heroControls.togglePinned(post.id, nextPinned)}
          totalPages={totalPages}
          total={data?.total ?? 0}
          page={filters.page}
          onDelete={setDeleteTarget}
          onPrev={() => filters.setPage((p) => Math.max(0, p - 1))}
          onNext={() => filters.setPage((p) => p + 1)}
        />

        {/* 삭제 확인 다이얼로그 */}
        <ConfirmDialog
          open={deleteTarget !== null}
          title="게시물 삭제"
          description={`"${deleteTarget?.title}" 게시물을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 연관된 댓글도 함께 삭제됩니다.`}
          confirmLabel="삭제"
          variant="danger"
          isPending={deleteMutation.isPending}
          onConfirm={() => {
            if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
          }}
          onCancel={clearDeleteTarget}
        />
      </div>
    </RequirePermission>
  );
}
