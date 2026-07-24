import type { Metadata } from "next";
import "@lol-sbti/ui/tokens.css";
import "./styles.css";

export const metadata: Metadata = {
  title: "临时 LBTI 报告 · LOL-SBTI",
  robots: { index: false, follow: false, nocache: true }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
