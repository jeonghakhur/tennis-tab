/**
 * className을 합치는 유틸리티 함수
 * shadcn/ui 스타일 참고
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
