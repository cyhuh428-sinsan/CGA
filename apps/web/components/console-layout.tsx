import Link from "next/link";
import { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
};

type ConsoleLayoutProps = {
  area: string;
  items: NavItem[];
  children: ReactNode;
};

export function ConsoleLayout({ area, items, children }: ConsoleLayoutProps) {
  return (
    <div className="console-shell">
      <aside className="console-sidebar">
        <div className="brand-block">
          <Link href="/" className="brand-link">
            Aidot
          </Link>
          <p className="sidebar-caption">{area}</p>
          <p className="sidebar-helper">원본 매뉴얼 기준 검토 브랜치</p>
        </div>
        <nav className="nav-list">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footnote">
          현재는 화면 흐름과 운영 흐름을 먼저 맞추고 있습니다.
        </div>
      </aside>
      <main className="console-main">{children}</main>
    </div>
  );
}
