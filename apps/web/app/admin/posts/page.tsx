"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import type { KeyboardEvent } from 'react';
import { useState } from 'react';

import { ConfirmDialog } from '../../../components/confirm-dialog';
import { RequireAdmin } from '../../../components/require-admin';
import { useToast } from '../../../components/toast';
import { useAuth } from '../../../hooks/useAuth';
import { ApiError } from '../../../lib/api';
import { apiErrorToMessage } from '../../../lib/error-map';
import {
  deletePost,
  listAdminPosts,
  type Post,
  type AdminPostListParams,
} from '../../../services/posts';

const PAGE_SIZE = 20;

/* ─────────────────────────────────────────────────────────────────────────
   Sub-components (complexity isolation)
───────────────────────────────────────────────────────────────────────── */

function StatusBadge({ published }: { published: boolean }) {
  if (published) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
        공개
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
      비공개
    </span>
  );
}

function CategoryBadge({ category }: { category: string | null | undefined }) {
  const labels: Record<string, string> = {
    notice: '공지',
    news: '소식',
    hero: '히어로',
  };
  const label = category ? labels[category] ?? category : '-';
  return <span className="text-xs text-slate-500">{label}</span>;
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
        className="rounded border border-slate-300 px-3 py-1.5 text-sm"
        value={categoryFilter}
        onChange={(e) => onCategoryChange(e.target.value)}
      >
        <option value="">전체 카테고리</option>
        <option value="notice">공지</option>
        <option value="news">소식</option>
        <option value="hero">히어로</option>
      </select>

      <select
        className="rounded border border-slate-300 px-3 py-1.5 text-sm"
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
          className="rounded-l border border-r-0 border-slate-300 px-3 py-1.5 text-sm"
          placeholder="검색어"
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="rounded-r border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm hover:bg-slate-100"
          onClick={onSearch}
        >
          검색
        </button>
      </div>

      <button
        type="button"
        className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        onClick={onRefresh}
      >
        새로고침
      </button>
    </div>
  );
}

type PostTableRowProps = {
  post: Post;
  onDelete: (post: Post) => void;
};

function PostTableRow({ post, onDelete }: PostTableRowProps) {
  return (
    <tr className="border-b hover:bg-slate-50">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {post.pinned && <span title="고정됨">📌</span>}
          <Link
            href={`/posts/${post.id}`}
            className="font-medium text-slate-900 hover:underline"
          >
            {post.title}
          </Link>
        </div>
        {post.author_name && (
          <div className="text-xs text-slate-500">{post.author_name}</div>
        )}
      </td>
      <td className="px-3 py-2">
        <CategoryBadge category={post.category} />
      </td>
      <td className="px-3 py-2">
        <StatusBadge published={!!post.published_at} />
      </td>
      <td className="px-3 py-2 text-slate-600">{post.view_count ?? 0}</td>
      <td className="px-3 py-2 text-slate-600">{post.comment_count ?? 0}</td>
      <td className="px-3 py-2 text-slate-600">{formatDate(post.published_at)}</td>
      <td className="px-3 py-2">
        <div className="flex gap-2">
          <Link
            href={`/admin/posts/${post.id}/edit`}
            className="text-slate-600 hover:text-slate-900"
            title="수정"
          >
            ✏️
          </Link>
          <button
            type="button"
            className="text-slate-600 hover:text-red-600"
            title="삭제"
            onClick={() => onDelete(post)}
          >
            🗑️
          </button>
        </div>
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
      <div className="text-sm text-slate-600">총 {total}건</div>
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

/* ─────────────────────────────────────────────────────────────────────────
   Main Page Component
───────────────────────────────────────────────────────────────────────── */

export default function AdminPostsPage() {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const { show } = useToast();

  const [page, setPage] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);

  const params: AdminPostListParams = {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    category: categoryFilter || undefined,
    status: (statusFilter as 'published' | 'draft') || undefined,
    q: searchQuery || undefined,
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-posts', params],
    queryFn: () => listAdminPosts(params),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePost(id),
    onSuccess: () => {
      show('게시물이 삭제되었습니다.', { type: 'success' });
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-posts'] });
    },
    onError: (e: unknown) => {
      const msg =
        e instanceof ApiError
          ? apiErrorToMessage(e.code, e.message)
          : '삭제 중 오류가 발생했습니다.';
      show(msg, { type: 'error' });
    },
  });

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setPage(0);
  };

  const handleCategoryChange = (v: string) => {
    setCategoryFilter(v);
    setPage(0);
  };

  const handleStatusChange = (v: string) => {
    setStatusFilter(v);
    setPage(0);
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  if (status !== 'authorized') {
    return (
      <div className="p-6 text-sm text-slate-600">관리자 로그인이 필요합니다.</div>
    );
  }

  return (
    <RequireAdmin
      fallback={<div className="p-6 text-sm text-slate-600">관리자 전용입니다.</div>}
    >
      <div className="p-6">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">게시물 관리</h2>
          <Link
            href="/posts/new"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + 새 글 작성
          </Link>
        </div>

        {/* 필터 */}
        <FilterBar
          categoryFilter={categoryFilter}
          onCategoryChange={handleCategoryChange}
          statusFilter={statusFilter}
          onStatusChange={handleStatusChange}
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          onSearch={handleSearch}
          onRefresh={() => void refetch()}
        />

        {/* 테이블 */}
        {isLoading ? (
          <div className="py-8 text-center text-sm text-slate-500">로딩 중...</div>
        ) : isError ? (
          <div className="py-8 text-center text-sm text-red-600">
            데이터를 불러올 수 없습니다.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-3 py-2 font-medium text-slate-700">제목</th>
                    <th className="px-3 py-2 font-medium text-slate-700">카테고리</th>
                    <th className="px-3 py-2 font-medium text-slate-700">상태</th>
                    <th className="px-3 py-2 font-medium text-slate-700">조회</th>
                    <th className="px-3 py-2 font-medium text-slate-700">댓글</th>
                    <th className="px-3 py-2 font-medium text-slate-700">발행일</th>
                    <th className="px-3 py-2 font-medium text-slate-700">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((post) => (
                    <PostTableRow
                      key={post.id}
                      post={post}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                  {data?.items.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                        게시물이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            <Pagination
              page={page}
              totalPages={totalPages}
              total={data?.total ?? 0}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          </>
        )}

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
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    </RequireAdmin>
  );
}
