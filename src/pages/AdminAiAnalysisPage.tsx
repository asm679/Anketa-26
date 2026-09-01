import { useEffect, useMemo, useState } from 'react';
import taxonomyData from '../content/taxonomy.json';
import type { SurveyResponse, Taxonomy } from '../lib/types';
import { fetchAllResponses, fetchAiReport, saveAiReport, ApiError } from '../lib/api';
import { buildAnonymizedAggregate } from '../lib/analytics';
import { buildPedagogicalPrompt } from '../lib/aiPrompt';
import { AI_PROVIDERS, callAiProvider, AiCallError, type AiProvider } from '../lib/aiProviders';
import { exportAiAnalysisBundle } from '../lib/export';
import { Card, Notice, PrimaryButton, SecondaryButton } from '../components/ui';

const taxonomy = taxonomyData as unknown as Taxonomy;

export default function AdminAiAnalysisPage() {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [provider, setProvider] = useState<AiProvider>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(AI_PROVIDERS[0].defaultModel);

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [reportText, setReportText] = useState<string>('');
  const [reportMeta, setReportMeta] = useState<{ generatedAt: string; provider: string; model: string; totalResponses: number } | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [data, lastReport] = await Promise.all([fetchAllResponses(), fetchAiReport().catch(() => null)]);
        setResponses(data);
        if (lastReport) {
          setReportText(lastReport.reportText);
          setReportMeta({
            generatedAt: lastReport.generatedAt,
            provider: lastReport.provider,
            model: lastReport.model,
            totalResponses: lastReport.totalResponses,
          });
        }
      } catch (e) {
        setLoadError(e instanceof ApiError ? e.message : 'Не удалось загрузить данные анкет.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const aggregate = useMemo(() => buildAnonymizedAggregate(taxonomy, responses), [responses]);
  const prompt = useMemo(() => buildPedagogicalPrompt(responses.length), [responses.length]);
  const currentProvider = AI_PROVIDERS.find((p) => p.id === provider)!;

  const handleProviderChange = (id: AiProvider) => {
    setProvider(id);
    const next = AI_PROVIDERS.find((p) => p.id === id);
    if (next) setModel(next.defaultModel);
  };

  const handleGenerate = async () => {
    if (!apiKey.trim()) {
      setRunError('Введите API-ключ выбранного провайдера — он используется только в вашем браузере и никуда не сохраняется.');
      return;
    }
    if (responses.length === 0) {
      setRunError('Нет ни одной анкеты для анализа.');
      return;
    }
    setRunning(true);
    setRunError(null);
    setSaveNotice(null);
    try {
      const fullPrompt = `${prompt}\n\n### Данные (JSON):\n${JSON.stringify(aggregate)}`;
      const text = await callAiProvider(provider, apiKey.trim(), model.trim(), fullPrompt);
      setReportText(text);
      const meta = {
        generatedAt: new Date().toISOString(),
        provider,
        model,
        totalResponses: responses.length,
      };
      setReportMeta(meta);
      try {
        await saveAiReport({ reportText: text, provider, model, totalResponses: responses.length });
        setSaveNotice('Отчёт сохранён на сервере и будет показан при следующем открытии страницы.');
      } catch {
        setSaveNotice('Отчёт сформирован, но не удалось сохранить его на сервере (показан только в этой сессии).');
      }
    } catch (e) {
      setRunError(e instanceof AiCallError ? e.message : 'Не удалось получить ответ от ИИ-провайдера.');
    } finally {
      setRunning(false);
    }
  };

  const handleExportBundle = () => {
    exportAiAnalysisBundle(prompt, aggregate);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <p className="text-muted text-sm">Загрузка данных…</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl text-navy-dark mb-1">ИИ-анализ для педагога</h1>
        <p className="text-sm text-muted">
          Формирует развёрнутые рекомендации по учебному процессу на основе агрегированных (анонимных) данных
          анкетирования — вызовом внешней ИИ-модели.
        </p>
      </div>

      {loadError && <Notice kind="error">{loadError}</Notice>}

      <Card className="mb-6">
        <h2 className="font-display text-base text-navy-dark mb-2">Как это работает и почему нужен ваш ключ</h2>
        <p className="text-sm text-ink leading-relaxed">
          Сайт анкетирования размещён на обычном хостинге без возможности безопасно хранить сторонние API-ключи на
          сервере. Поэтому запрос к ИИ-провайдеру выполняется прямо из вашего браузера: вы вводите свой ключ ниже,
          он используется один раз для запроса и не сохраняется — ни на сервере, ни в этом приложении между
          перезагрузками страницы. В модель передаются только{' '}
          <span className="font-medium">агрегированные обезличенные показатели</span> по группе (без ФИО, Telegram и
          email) — конкретные ответы участников не раскрываются.
        </p>
      </Card>

      <Card className="mb-6">
        <h2 className="font-display text-base text-navy-dark mb-3">Настройка вызова</h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <label className="block">
            <span className="block text-sm font-medium text-ink mb-1">Провайдер</span>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm bg-white"
            >
              {AI_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="block text-xs text-faint mt-1">{currentProvider.hint}</span>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-ink mb-1">Модель</span>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              list="model-suggestions"
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm bg-white"
            />
            <datalist id="model-suggestions">
              {currentProvider.modelSuggestions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
        </div>
        <label className="block mb-4">
          <span className="block text-sm font-medium text-ink mb-1">API-ключ ({currentProvider.label})</span>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-... / AIza..."
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm bg-white font-mono"
              autoComplete="off"
            />
            <SecondaryButton onClick={() => setShowKey((v) => !v)}>{showKey ? 'Скрыть' : 'Показать'}</SecondaryButton>
          </div>
          <span className="block text-xs text-faint mt-1">
            Ключ хранится только в памяти этой страницы и передаётся напрямую в API провайдера — не на бэкенд сайта.
          </span>
        </label>

        {runError && (
          <div className="mb-4">
            <Notice kind="error">{runError}</Notice>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <PrimaryButton onClick={handleGenerate} disabled={running}>
            {running ? 'Формирую анализ…' : 'Сформировать ИИ-анализ'}
          </PrimaryButton>
          <SecondaryButton onClick={handleExportBundle}>Экспорт данных и промпта для ИИ (без ключа)</SecondaryButton>
        </div>
      </Card>

      {saveNotice && (
        <div className="mb-6">
          <Notice kind="success">{saveNotice}</Notice>
        </div>
      )}

      {reportText && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="font-display text-lg text-navy-dark">Отчёт ИИ-анализа</h2>
            {reportMeta && (
              <span className="text-xs text-muted">
                Обновлено: {new Date(reportMeta.generatedAt).toLocaleString('ru-RU')} · {reportMeta.totalResponses}{' '}
                анкет · {reportMeta.provider} / {reportMeta.model}
              </span>
            )}
          </div>
          <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{reportText}</div>
        </Card>
      )}

      <Card className="mt-6">
        <h2 className="font-display text-base text-navy-dark mb-2">Промпт, который будет использован</h2>
        <p className="text-xs text-muted mb-3">
          Ровно этот текст (плюс JSON с агрегированными данными) отправляется провайдеру. Тот же текст входит в файл
          экспорта выше.
        </p>
        <pre className="text-xs text-ink whitespace-pre-wrap bg-surface-alt rounded-lg p-3 overflow-x-auto">
          {prompt}
        </pre>
      </Card>
    </div>
  );
}
