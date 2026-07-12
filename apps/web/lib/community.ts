export const BOARD_CATEGORY_KEYS = ['discussion', 'question', 'share', 'congrats'] as const;

export type BoardCategoryKey = (typeof BOARD_CATEGORY_KEYS)[number];

export type BoardCategoryInfo = {
  label: string;
  shortLabel: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  titlePlaceholder: string;
  contentPlaceholder: string;
};

const BOARD_CATEGORY_INFO: Record<BoardCategoryKey, BoardCategoryInfo> = {
  discussion: {
    label: '자유게시판',
    shortLabel: '자유',
    description: '동문들과 편하게 안부와 이야기를 나누는 공간입니다.',
    emptyTitle: '아직 나눈 이야기가 없습니다.',
    emptyDescription: '먼저 안부를 건네거나 동문들과 나누고 싶은 이야기를 남겨 보세요.',
    titlePlaceholder: '동문들에게 전할 이야기의 제목을 적어 주세요',
    contentPlaceholder: '안부, 근황, 함께 나누고 싶은 이야기를 편하게 적어 주세요.',
  },
  question: {
    label: '묻고 답하기',
    shortLabel: '질문',
    description: '동문에게 궁금한 점을 묻고 경험을 나누는 공간입니다.',
    emptyTitle: '아직 등록된 질문이 없습니다.',
    emptyDescription: '동문의 경험이 필요한 질문을 먼저 남겨 보세요.',
    titlePlaceholder: '궁금한 내용을 한눈에 알 수 있는 제목을 적어 주세요',
    contentPlaceholder: '상황과 궁금한 점을 구체적으로 적으면 더 좋은 답을 받을 수 있습니다.',
  },
  share: {
    label: '동문 이야기·행사 후기',
    shortLabel: '이야기·후기',
    description: '동문의 활동과 행사 현장을 사진과 함께 나누는 공간입니다.',
    emptyTitle: '아직 동문 이야기나 행사의 기록이 없습니다.',
    emptyDescription: '기억하고 싶은 만남과 동문의 반가운 소식을 사진과 함께 남겨 보세요.',
    titlePlaceholder: '동문 이야기나 행사 이름을 적어 주세요',
    contentPlaceholder: '누가, 언제, 어디에서 함께했는지와 기억하고 싶은 이야기를 적어 주세요.',
  },
  congrats: {
    label: '경조사',
    shortLabel: '경조사',
    description: '동문의 기쁜 일과 위로를 나누며 마음을 전하는 공간입니다.',
    emptyTitle: '현재 전해진 경조사 소식이 없습니다.',
    emptyDescription: '함께 축하하거나 위로할 소식이 있다면 정중하게 알려 주세요.',
    titlePlaceholder: '경사 또는 조사와 동문 이름을 적어 주세요',
    contentPlaceholder: '구분, 일시, 장소, 연락처 등 마음을 전하는 데 필요한 내용을 적어 주세요.',
  },
};

export function isBoardCategory(value: string | null | undefined): value is BoardCategoryKey {
  return BOARD_CATEGORY_KEYS.some((category) => category === value);
}

export function getBoardCategoryInfo(value: BoardCategoryKey): BoardCategoryInfo;
export function getBoardCategoryInfo(value: string | null | undefined): BoardCategoryInfo | null;
export function getBoardCategoryInfo(value: string | null | undefined): BoardCategoryInfo | null {
  return isBoardCategory(value) ? BOARD_CATEGORY_INFO[value] : null;
}

export function getPostCategoryLabel(value: string | null | undefined): string | null {
  if (isBoardCategory(value)) return BOARD_CATEGORY_INFO[value].label;
  if (value === 'notice') return '공지사항';
  if (value === 'news') return '동문 소식';
  return null;
}

export function getAuthorName(authorName: string | null | undefined): string {
  return authorName?.trim() || '이름을 공개하지 않은 동문';
}
