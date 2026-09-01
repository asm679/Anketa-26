// Типы данных приложения. Должны точно соответствовать webapp_spec.md и коду Worker (worker/src/index.js).

export interface TaxonomyItem {
  id: string;
  short: string;
  desc: string;
}

export interface TaxonomyBlock {
  code: string;
  title: string;
  primary: string[];
  secondary: string[];
  intro: string;
  items: TaxonomyItem[];
}

export interface Taxonomy {
  disciplines: Record<string, { code: string; full: string }>;
  blocks: TaxonomyBlock[];
}

// T1..T17 — инструменты, P1..P11 — практический опыт
export const TOOLS: { id: string; label: string }[] = [
  { id: 'T1', label: 'ChatGPT / GPT (OpenAI)' },
  { id: 'T2', label: 'Claude (Anthropic)' },
  { id: 'T3', label: 'Gemini (Google)' },
  { id: 'T4', label: 'DeepSeek' },
  { id: 'T5', label: 'YandexGPT / Алиса' },
  { id: 'T6', label: 'GigaChat (Сбер)' },
  { id: 'T7', label: 'Perplexity' },
  { id: 'T8', label: 'GitHub Copilot' },
  { id: 'T9', label: 'Cursor / Windsurf' },
  { id: 'T10', label: 'Midjourney / DALL·E / Stable Diffusion' },
  { id: 'T11', label: 'Runway / Sora / Veo' },
  { id: 'T12', label: 'Ollama / LM Studio (локальные модели)' },
  { id: 'T13', label: 'Hugging Face' },
  { id: 'T14', label: 'LangChain / LangGraph / AutoGen / CrewAI' },
  { id: 'T15', label: 'Jupyter / Google Colab' },
  { id: 'T16', label: 'QGIS / ГИС-инструменты с элементами ИИ' },
  { id: 'T17', label: 'n8n / Make / другие no-code платформы с ИИ' },
];

export const PRACTICE: { id: string; label: string }[] = [
  { id: 'P1', label: 'Обучение модели машинного обучения "с нуля"' },
  { id: 'P2', label: 'Fine-tuning / дообучение предобученной модели' },
  { id: 'P3', label: 'Разработка RAG-системы' },
  { id: 'P4', label: 'Разработка ИИ-агента или мультиагентной системы' },
  { id: 'P5', label: 'Работа с векторными базами данных' },
  { id: 'P6', label: 'Промпт-инжиниринг для прикладных задач' },
  { id: 'P7', label: 'Работа с API языковых моделей (OpenAI/Anthropic и др.)' },
  { id: 'P8', label: 'Обработка изображений/видео нейросетевыми методами' },
  { id: 'P9', label: 'Участие в хакатоне или проекте с использованием ИИ' },
  { id: 'P10', label: 'Публикация/участие в исследовании по теме ИИ' },
  { id: 'P11', label: 'Применение ИИ в геоинформатике/геодезии/навигации' },
];

export interface SurveyResponse {
  telegram: string;
  slug: string;
  fio: string;
  direction: string;
  profile: string;
  institute: string;
  email?: string;
  consent152fz: boolean;
  scores: Record<string, number>;
  tools: Record<string, boolean>;
  practice: Record<string, boolean>;
  background: {
    bachelorDirection: string;
    bachelorProfile: string;
    experienceYears: string;
    programmingLanguages: string;
    studyPlace: string;
  };
  desiredBlocks: string[];
  desiredBlocksOther?: string;
  motivation: number;
  expectations?: string;
  submittedAt: string;
  updatedAt: string;
  version: number;
}

export interface AdminUser {
  id: string;
  username: string;
  role: 'admin' | 'viewer';
  createdAt: string;
  updatedAt: string;
}

// Приводит введённое имя пользователя Telegram к чистому виду "nick_name":
// убирает ведущий(-ие) "@", пробелы по краям и ссылочные префиксы вида t.me/.
export function normalizeTelegram(input: string): string {
  let v = (input || '').trim();
  v = v.replace(/^https?:\/\/(t(elegram)?\.me|telegram\.org)\//i, '');
  v = v.replace(/^@+/, '');
  v = v.trim();
  return v;
}

export function slugifyTicket(ticket: string): string {
  return ticket
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё_-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'unknown';
}

export function slugifyTelegram(telegram: string): string {
  return slugifyTicket(normalizeTelegram(telegram));
}
