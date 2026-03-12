import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { FontSizeProvider } from "@/components/FontSizeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "마포구테니스협회 | 테니스 대회의 새로운 기준",
  description:
    "대회 생성부터 참가 신청, 클럽 관리까지. 테니스 커뮤니티를 위한 올인원 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <head>
        {/* 주요 폰트 preload - FOUT 방지 */}
        <link rel="preload" href="/font/SUIT-Variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/font/Paperlogy-7Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/font/Paperlogy-6SemiBold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {/* 테마 깜빡임 방지: React 로드 전에 테마 미리 적용 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  document.documentElement.setAttribute('data-theme', theme);
                  if (theme === 'dark') document.documentElement.classList.add('dark');
                  else document.documentElement.classList.remove('dark');
                } catch(e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col">
        <ThemeProvider>
          <FontSizeProvider>
            <AuthProvider>
              <Navigation />
              <main className="flex-1 pt-20">
                {children}
              </main>
              <Footer />
            </AuthProvider>
          </FontSizeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
