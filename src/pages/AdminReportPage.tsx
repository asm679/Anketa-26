import { useEffect, useMemo, useState } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import taxonomyData from '../content/taxonomy.json';
import type { SurveyResponse, Taxonomy } from '../lib/types';
import { TOOLS, PRACTICE } from '../lib/types';
import { fetchAllResponses, ApiError } from '../lib/api';
import {
  computeBlockStats,
  computeRecommendedTopics,
  computeTicketBlockProfile,
  overallAverage,
  toolsUsageStats,
  practiceUsageStats,
  motivationDistribution,
} from '../lib/analytics';
import { exportResponsesCsv, exportResponsesJson, printPage } from '../lib/export';
import { Card, Notice, SecondaryButton, PrimaryButton } from '../components/ui';

const taxonomy = taxonomyData as unknown as Taxonomy;
const ALL_ITEM_IDS = taxonomy.blocks.flatMap((b) => b.items.map((i) => i.id));

const MOTIVATION_COLORS = ['#A12C2C', '#9C6A1E', '#5B5F66', '#2E4E7A', '#3E7A3E'];

function scoreColor(avg: number): string {
  if (avg < 2) return '#A12C2C';
  if (avg < 3) return '#9C6A1E';
  if (avg < 4) return '#2E4E7A';
  return '#3E7A3E';
}

export default function AdminReportPage() {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchAllResponses();
        setResponses(data);
        if (data.length > 0) setSelectedTicket(data[0].ticket);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Не удалось загрузить данные анкет.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const blockStats = useMemo(() => computeBlockStats(taxonomy, responses), [responses]);
  const recommendedTopics = useMemo(() => computeRecommendedTopics(taxonomy, responses, 15), [responses]);
  const avgAll = useMemo(() => overallAverage(responses), [responses]);
  const toolsStats = useMemo(() => toolsUsageStats(responses, TOOLS.map((t) => t.id)), [responses]);
  const practiceStats = useMemo(() => practiceUsageStats(responses, PRACTICE.map((p) => p.id)), [responses]);
  const motivationDist = useMemo(() => motivationDistribution(responses), [responses]);

  const selectedResponse = responses.find((r) => r.ticket === selectedTicket) || null;
  const ticketProfile = useMemo(
    () => (selectedResponse ? computeTicketBlockProfile(taxonomy, selectedResponse) : []),
    [selectedResponse]
  );

  const summaryText = useMemo(() => buildGroupSummary(responses, blockStats, avgAll), [responses, blockStats, avgAll]);
  const ticketSummary = useMemo(
    () => (selectedResponse ? buildTicketSummary(selectedResponse, ticketProfile) : ''),
    [selectedResponse, ticketProfile]
  );

  const motivationPieData = [1, 2, 3, 4, 5].map((v, i) => ({
    name: `${v} балл${v === 1 ? '' : v < 5 ? 'а' : 'ов'}`,
    value: motivationDist[v],
    color: MOTIVATION_COLORS[i],
  }));

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <p className="text-muted text-sm">Формирование отчёта…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <Notice kind="error">{error}</Notice>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 print:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
        <div>
          <h1 className="font-display text-2xl text-navy-dark mb-1">Итоговый отчёт по анкетированию</h1>
          <p className="text-sm text-muted">Всего анкет: {responses.length}</p>
        </div>
        <div className="flex gap-2">
          <SecondaryButton onClick={() => exportResponsesJson(responses)}>Экспорт JSON</SecondaryButton>
          <SecondaryButton onClick={() => exportResponsesCsv(responses, ALL_ITEM_IDS)}>Экспорт CSV</SecondaryButton>
          <PrimaryButton onClick={printPage}>Печать / PDF</PrimaryButton>
        </div>
      </div>

      {responses.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Пока нет ни одной отправленной анкеты для формирования отчёта.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Рекомендованные темы */}
          <Card>
            <h2 className="font-display text-lg text-navy-dark mb-1">Рекомендованные темы для повторения</h2>
            <p className="text-sm text-muted mb-4">
              Темы ранжированы по среднему баллу самооценки (от низшего к высшему) и привязаны к дисциплинам
              учебного плана.
            </p>
            <div className="space-y-2">
              {recommendedTopics.map((t, idx) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border-light px-4 py-2.5"
                >
                  <div>
                    <p className="text-sm text-ink">
                      <span className="text-faint mr-2">
                        №{idx + 1} · {t.id}
                      </span>
                      {t.short}
                    </p>
                    <div className="flex gap-1.5 mt-1">
                      {t.disciplines.map((d) => (
                        <span key={d} className="text-xs rounded-full bg-gold/10 text-gold px-2 py-0.5">
                          {taxonomy.disciplines[d]?.code || d}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="font-display text-lg font-semibold shrink-0" style={{ color: scoreColor(t.average) }}>
                    {t.average.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Статистическая сводка */}
          <Card>
            <h2 className="font-display text-lg text-navy-dark mb-4">Статистическая сводка</h2>
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <StatBox label="Средний балл по всем блокам" value={avgAll.toFixed(2)} />
              <StatBox label="Заполнено анкет" value={String(responses.length)} />
              <StatBox
                label="Средняя мотивация"
                value={
                  responses.length
                    ? (responses.reduce((a, r) => a + (r.motivation || 0), 0) / responses.length).toFixed(2)
                    : '—'
                }
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-ink mb-2">Использование инструментов ИИ (% анкет)</h3>
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={toolsStats} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="id" width={35} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={((v: number) => `${v.toFixed(0)}%`) as unknown as (value: unknown) => string}
                      labelFormatter={((id: unknown) => TOOLS.find((t) => t.id === id)?.label || String(id)) as unknown as (label: unknown) => string}
                    />
                    <Bar dataKey="pct" radius={[0, 4, 4, 0]} fill="#2E4E7A" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h3 className="text-sm font-medium text-ink mb-2">Практический опыт (% анкет)</h3>
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={practiceStats} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="id" width={35} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={((v: number) => `${v.toFixed(0)}%`) as unknown as (value: unknown) => string}
                      labelFormatter={((id: unknown) => PRACTICE.find((p) => p.id === id)?.label || String(id)) as unknown as (label: unknown) => string}
                    />
                    <Bar dataKey="pct" radius={[0, 4, 4, 0]} fill="#9C7A2A" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-medium text-ink mb-2">Распределение мотивации (1–5)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={motivationPieData} dataKey="value" nameKey="name" outerRadius={90} label>
                    {motivationPieData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Профиль компетенций по билету */}
          <Card>
            <h2 className="font-display text-lg text-navy-dark mb-1">Профиль компетенций по билету</h2>
            <p className="text-sm text-muted mb-4">Радар-диаграмма среднего балла по блокам A–I для выбранного билета.</p>
            <label className="block mb-4 max-w-xs">
              <span className="block text-sm font-medium text-ink mb-1">Выберите билет</span>
              <select
                value={selectedTicket}
                onChange={(e) => setSelectedTicket(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm bg-white"
              >
                {responses.map((r) => (
                  <option key={r.ticket} value={r.ticket}>
                    {r.ticket} — {r.fio}
                  </option>
                ))}
              </select>
            </label>

            {selectedResponse && (
              <div className="grid md:grid-cols-2 gap-6 items-start">
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={ticketProfile}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="code" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                    <Radar name={selectedResponse.ticket} dataKey="average" stroke="#12305C" fill="#12305C" fillOpacity={0.35} />
                    <Tooltip formatter={((v: number) => v.toFixed(2)) as unknown as (value: unknown) => string} />
                  </RadarChart>
                </ResponsiveContainer>
                <div>
                  <p className="text-sm text-ink whitespace-pre-line">{ticketSummary}</p>
                </div>
              </div>
            )}
          </Card>

          {/* Общий вывод */}
          <Card>
            <h2 className="font-display text-lg text-navy-dark mb-3">Итоговый вывод по группе</h2>
            <p className="text-sm text-ink whitespace-pre-line leading-relaxed">{summaryText}</p>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-light px-4 py-3">
      <p className="text-xs text-faint mb-1">{label}</p>
      <p className="font-display text-2xl text-navy-dark">{value}</p>
    </div>
  );
}

function buildGroupSummary(
  responses: SurveyResponse[],
  blockStats: ReturnType<typeof computeBlockStats>,
  avgAll: number
): string {
  if (responses.length === 0) return '';
  const sorted = [...blockStats].sort((a, b) => b.average - a.average);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const level =
    avgAll >= 4
      ? 'высокий'
      : avgAll >= 3
        ? 'выше среднего'
        : avgAll >= 2
          ? 'средний'
          : 'начальный';

  return [
    `По результатам обработки ${responses.length} анкет средний уровень самооценки знаний группы по всем блокам составляет ${avgAll.toFixed(2)} из 5, что соответствует ${level} уровню подготовки поступающих.`,
    `Наиболее уверенно группа оценивает раздел «${strongest.title}» (блок ${strongest.code}, средний балл ${strongest.average.toFixed(2)}) — эту область можно рассматривать как базу для углублённого изучения на первом курсе.`,
    `Наименее уверенно группа чувствует себя в разделе «${weakest.title}» (блок ${weakest.code}, средний балл ${weakest.average.toFixed(2)}) — рекомендуется уделить этому блоку повышенное внимание во вводных занятиях и организовать дополнительные консультации.`,
    `Рекомендуется сформировать вводный модуль повторения на основе списка рекомендованных тем (см. раздел выше), распределив материал по дисциплинам учебного плана (ВС, ИС, ТРПО, СПИ) пропорционально выявленным пробелам.`,
  ].join('\n\n');
}

function buildTicketSummary(
  response: SurveyResponse,
  profile: { code: string; title: string; average: number }[]
): string {
  const sorted = [...profile].sort((a, b) => b.average - a.average);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const avg = profile.length ? profile.reduce((a, b) => a + b.average, 0) / profile.length : 0;
  const motivationText = response.motivation
    ? `Уровень заявленной мотивации к обучению: ${response.motivation} из 5.`
    : 'Уровень мотивации не указан.';

  return [
    `Билет ${response.ticket} (${response.fio}).`,
    `Средний балл самооценки по всем блокам: ${avg.toFixed(2)} из 5.`,
    `Наиболее сильная область: «${strongest.title}» (блок ${strongest.code}, ${strongest.average.toFixed(2)}).`,
    `Наиболее слабая область: «${weakest.title}» (блок ${weakest.code}, ${weakest.average.toFixed(2)}).`,
    motivationText,
  ].join('\n');
}
