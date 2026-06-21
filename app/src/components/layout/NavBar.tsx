'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bars3Icon, XMarkIcon, UserCircleIcon } from '@heroicons/react/24/outline';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  // Extra path prefixes that should also mark this item active.
  activeAlso?: string[];
};

const navItems: NavItem[] = [
  { href: '/binnen', label: 'SBF Binnen', icon: '🚢', activeAlso: ['/ueben/binnen'] },
  { href: '/see', label: 'SBF See', icon: '⛵', activeAlso: ['/ueben/see'] },
  { href: '/navigation', label: 'Navigation', icon: '🧭' },
  { href: '/lernen', label: 'Theorie', icon: '📖' },
];

function isItemActive(item: NavItem, pathname: string): boolean {
  if (pathname.startsWith(item.href)) return true;
  return (item.activeAlso ?? []).some((p) => pathname.startsWith(p));
}

export function NavBar(): React.ReactElement {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        background: 'rgba(6, 12, 24, 0.92)',
        backdropFilter: 'blur(16px)',
        borderColor: 'var(--border)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center group" aria-label="Start">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
              style={{
                background: 'var(--gold-light)',
                color: '#030810',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.10)',
              }}
            >
              ⚓
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => {
              const active = isItemActive(item, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={{
                    color: active ? 'var(--white)' : 'var(--muted)',
                    background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                  }}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
            <Link
              href="/profil"
              className="p-1.5 rounded-md transition-colors hover:bg-white/5"
              style={{ color: pathname?.startsWith('/profil') ? 'var(--white)' : 'var(--muted)' }}
              aria-label="Profil"
            >
              <UserCircleIcon className="h-6 w-6" />
            </Link>
            <button
              className="md:hidden p-1.5 rounded-md"
              style={{ color: 'var(--muted)' }}
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Navigation öffnen"
            >
              {mobileOpen ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="px-4 py-2 space-y-0.5">
            {navItems.map((item) => {
              const active = isItemActive(item, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-md text-sm font-medium transition-colors"
                  style={{
                    color: active ? 'var(--gold-light)' : 'var(--muted)',
                    background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
                  }}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
