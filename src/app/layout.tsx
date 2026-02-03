import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tennis Tab | 테니스 대회의 새로운 기준",
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
      <body className="font-body antialiased">
        <ThemeProvider>
          <AuthProvider>
            <Navigation />
            <main className="min-h-screen pt-20">
              {children}
            </main>
            <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
