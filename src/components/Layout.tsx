import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import kafLogo from '/logos/kaf_logo.png';
import rutEmblem from '/logos/rut_emblem.png';
import { useAuth } from '../lib/AuthContext';

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isAuthenticated, username, role, logout } = useAuth();
  const isAdminArea = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <header className="bg-navy-dark text-white border-b border-navy-med/40 print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <img src={rutEmblem} alt="Эмблема РУТ (МИИТ)" className="h-12 w-auto object-contain shrink-0" />
          <img src={kafLogo} alt="Логотип кафедры" className="h-12 w-auto object-contain shrink-0" />
          <div className="min-w-0">
            <p className="font-display text-base sm:text-lg leading-tight truncate">
              Анкетирование поступающих
            </p>
            <p className="text-xs sm:text-sm text-white/75 leading-tight truncate">
              Направление «Искусственный интеллект» · РУТ (МИИТ)
            </p>
          </div>
          {isAdminArea && (
            <nav className="ml-auto flex items-center gap-3 text-sm">
              <Link to="/admin/dashboard" className="hover:text-gold-light transition-colors">
                Дашборд
              </Link>
              {role === 'admin' && (
                <Link to="/admin/users" className="hover:text-gold-light transition-colors">
                  Пользователи
                </Link>
              )}
              <Link to="/admin/report" className="hover:text-gold-light transition-colors">
                Отчёт
              </Link>
              {isAuthenticated && (
                <span className="hidden sm:inline text-white/60 text-xs">
                  {username} ({role === 'admin' ? 'администратор' : 'наблюдатель'})
                </span>
              )}
              {isAuthenticated && (
                <button
                  onClick={logout}
                  className="rounded border border-white/30 px-3 py-1 text-xs hover:bg-white/10 transition-colors"
                >
                  Выйти
                </button>
              )}
            </nav>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="text-center text-xs text-faint py-6 print:hidden">
        РУТ (МИИТ) · Входное анкетирование поступающих по направлению «Искусственный интеллект»
      </footer>
    </div>
  );
}
