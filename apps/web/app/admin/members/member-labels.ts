const MEMBER_STATUS_LABELS: Record<string, string> = {
  active: '활성',
  pending: '대기',
  suspended: '정지',
  rejected: '거부',
};

export function memberStatusLabel(status: string): string {
  return MEMBER_STATUS_LABELS[status] ?? status;
}
