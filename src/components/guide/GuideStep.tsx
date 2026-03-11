import Image from "next/image";
import { type LucideIcon } from "lucide-react";

interface GuideStepListProps {
  layout?: "list";
  step: number;
  emoji?: string;
  Icon?: LucideIcon;
  title: string;
  description: React.ReactNode;
  variant: "neon" | "blue";
  /** public/guide/screenshots/ 기준 파일명 */
  screenshot?: string;
  screenshotAlt?: string;
}

interface GuideStepGridProps {
  layout: "grid";
  step: number;
  emoji?: string;
  Icon?: LucideIcon;
  title: string;
  description: React.ReactNode;
  variant?: "mono";
  screenshot?: never;
  screenshotAlt?: never;
}

type GuideStepProps = GuideStepListProps | GuideStepGridProps;

export function GuideStep(props: GuideStepProps) {
  const { step, emoji, Icon, title, description } = props;
  const screenshot = props.layout !== "grid" ? props.screenshot : undefined;
  const screenshotAlt = props.layout !== "grid" ? props.screenshotAlt : undefined;

  if (props.layout === "grid") {
    return (
      <div
        className="group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1"
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* 배경 워터마크 숫자 */}
        <div
          className="pointer-events-none absolute right-3 top-1 select-none font-black italic leading-none"
          style={{
            fontSize: "80px",
            color: "rgba(255,255,255,0.04)",
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          {String(step).padStart(2, "0")}
        </div>

        {/* 스텝 번호 */}
        <div
          className="mb-3 inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold"
          style={{
            backgroundColor: "rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          {String(step).padStart(2, "0")}
        </div>

        {/* 아이콘 */}
        <div className="mb-3 text-2xl" aria-hidden="true">
          {emoji && <span>{emoji}</span>}
          {Icon && <Icon size={24} style={{ color: "rgba(255,255,255,0.7)" }} />}
        </div>

        {/* 내용 */}
        <h3
          className="font-bold text-sm mb-1.5"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h3>
        <p
          className="text-xs leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          {description}
        </p>
      </div>
    );
  }

  // list 레이아웃 (neon / blue)
  const variant = (props as GuideStepListProps).variant;
  const accentColor = variant === "neon" ? "#ccff00" : "#3B82F6";
  const accentBg =
    variant === "neon"
      ? "rgba(204, 255, 0, 0.04)"
      : "rgba(59, 130, 246, 0.04)";
  const accentBorder =
    variant === "neon"
      ? "rgba(204, 255, 0, 0.15)"
      : "rgba(59, 130, 246, 0.15)";
  const accentLeft =
    variant === "neon"
      ? "rgba(204, 255, 0, 0.5)"
      : "rgba(59, 130, 246, 0.5)";

  return (
    <div
      className="group flex gap-0 rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.01]"
      style={{
        backgroundColor: accentBg,
        border: `1px solid ${accentBorder}`,
      }}
    >
      {/* 왼쪽 컬러 바 */}
      <div
        className="w-1 shrink-0 transition-all duration-300 group-hover:w-1.5"
        style={{ backgroundColor: accentLeft }}
      />

      {/* 스텝 번호 */}
      <div className="shrink-0 flex items-center justify-center w-20 px-4 py-5">
        <span
          className="font-black italic tabular-nums leading-none"
          style={{
            fontSize: "44px",
            color: accentColor,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
          aria-label={`${step}단계`}
        >
          {String(step).padStart(2, "0")}
        </span>
      </div>

      {/* 구분선 */}
      <div
        className="w-px self-stretch my-4"
        style={{ backgroundColor: accentBorder }}
      />

      {/* 내용 */}
      <div className="flex-1 min-w-0 px-5 py-5">
        <div className="flex items-center gap-2 mb-2">
          {emoji && (
            <span className="text-xl" aria-hidden="true">
              {emoji}
            </span>
          )}
          {Icon && (
            <Icon size={18} style={{ color: accentColor }} aria-hidden="true" />
          )}
          <h3
            className="font-bold text-base"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h3>
        </div>
        <div
          className="text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {description}
        </div>

        {/* 스크린샷 */}
        {screenshot && (
          <div className="mt-4 rounded-xl overflow-hidden border" style={{ borderColor: accentBorder }}>
            <Image
              src={`/guide/screenshots/${screenshot}`}
              alt={screenshotAlt ?? title}
              width={800}
              height={450}
              className="w-full h-auto object-cover object-top"
              style={{ maxHeight: "240px" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
