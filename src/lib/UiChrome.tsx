// Лёгкий общий контекст для управления "компактным" режимом отображения —
// используется страницей авторизации, чтобы скрыть подвал и уменьшить отступы,
// обеспечивая полную видимость страницы (включая QR-код) на экране 1024x768
// при проекции без прокрутки.
import { createContext, useContext, useState, type ReactNode } from 'react';

interface UiChromeState {
  compact: boolean;
  setCompact: (v: boolean) => void;
}

const UiChromeContext = createContext<UiChromeState | undefined>(undefined);

export function UiChromeProvider({ children }: { children: ReactNode }) {
  const [compact, setCompact] = useState(false);
  return <UiChromeContext.Provider value={{ compact, setCompact }}>{children}</UiChromeContext.Provider>;
}

export function useUiChrome(): UiChromeState {
  const ctx = useContext(UiChromeContext);
  if (!ctx) {
    // Не бросаем ошибку, чтобы страница не падала, если провайдер забыт —
    // просто ведём себя как обычный (не компактный) режим.
    return { compact: false, setCompact: () => {} };
  }
  return ctx;
}
