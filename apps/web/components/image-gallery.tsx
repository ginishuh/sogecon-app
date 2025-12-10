import Image from 'next/image';

export interface ImageGalleryProps {
  coverImage?: string | null;
  images?: string[] | null;
}

/** 이미지 갤러리 컴포넌트 - 게시글 상세 페이지용 */
export function ImageGallery({ coverImage, images }: ImageGalleryProps) {
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
