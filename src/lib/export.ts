// Экспорт данных в JSON/CSV и запуск печати.
import type { SurveyResponse } from './types';

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportResponsesJson(responses: SurveyResponse[]) {
  downloadFile(
    `anketa26-responses-${Date.now()}.json`,
    JSON.stringify(responses, null, 2),
    'application/json'
  );
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n;]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function exportResponsesCsv(responses: SurveyResponse[], scoreIds: string[]) {
  const headers = [
    'telegram',
    'fio',
    'direction',
    'profile',
    'institute',
    'email',
    'motivation',
    'desiredBlocks',
    ...scoreIds,
  ];
  const lines = [headers.join(';')];
  for (const r of responses) {
    const row = [
      r.telegram,
      r.fio,
      r.direction,
      r.profile,
      r.institute,
      r.email || '',
      r.motivation,
      (r.desiredBlocks || []).join(', '),
      ...scoreIds.map((id) => r.scores?.[id] ?? ''),
    ];
    lines.push(row.map(csvEscape).join(';'));
  }
  downloadFile(`anketa26-responses-${Date.now()}.csv`, '\uFEFF' + lines.join('\n'), 'text/csv;charset=utf-8');
}

export function printPage() {
  window.print();
}

// Экспорт анонимизированных агрегатов + готовый промпт — для вставки вручную в любой
// внешний ИИ-чат (ChatGPT, Claude, Gemini и т.п.), если педагог не хочет вводить API-ключ в панели.
export function exportAiAnalysisBundle(promptText: string, aggregateJson: unknown) {
  const content = [
    promptText,
    '',
    '---',
    '',
    '### Данные (JSON) — вставьте целиком после текста выше в чат с любым ИИ:',
    '',
    '```json',
    JSON.stringify(aggregateJson, null, 2),
    '```',
  ].join('\n');
  downloadFile(`anketa26-ai-export-${Date.now()}.md`, content, 'text/markdown;charset=utf-8');
}
