// Прямые вызовы внешних ИИ-провайдеров из браузера (BYO API-ключ, ключ не покидает
// клиент, не отправляется на бэкенд и не сохраняется — вводится в поле формы на время
// сессии и держится только в React state).

export type AiProvider = 'openrouter' | 'gemini';

export interface AiProviderOption {
  id: AiProvider;
  label: string;
  hint: string;
  defaultModel: string;
  modelSuggestions: string[];
}

export const AI_PROVIDERS: AiProviderOption[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    hint: 'Один ключ — доступ к моделям многих разработчиков (Anthropic, Google, DeepSeek и др.). Рекомендуется, если у вас уже есть аккаунт на openrouter.ai.',
    defaultModel: 'anthropic/claude-3.7-sonnet',
    modelSuggestions: [
      'anthropic/claude-3.7-sonnet',
      'google/gemini-2.5-flash',
      'openai/gpt-4o-mini',
      'deepseek/deepseek-chat',
    ],
  },
  {
    id: 'gemini',
    label: 'Google Gemini (прямой API)',
    hint: 'Ключ из Google AI Studio (aistudio.google.com/app/apikey). Вызов идёт напрямую к API Google, без посредников.',
    defaultModel: 'gemini-2.0-flash',
    modelSuggestions: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  },
];

export class AiCallError extends Error {}

export async function callAiProvider(
  provider: AiProvider,
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  if (provider === 'openrouter') {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://anketa26',
        'X-Title': 'Anketa-26 — групповой анализ',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new AiCallError(data?.error?.message || `Ошибка OpenRouter (${res.status})`);
    }
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new AiCallError('OpenRouter вернул пустой ответ.');
    return text as string;
  }

  if (provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new AiCallError(data?.error?.message || `Ошибка Gemini API (${res.status})`);
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('');
    if (!text) throw new AiCallError('Gemini вернул пустой ответ.');
    return text as string;
  }

  throw new AiCallError('Неизвестный провайдер ИИ.');
}
