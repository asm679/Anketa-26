import { useEffect, useMemo, useState } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import taxonomyData from '../content/taxonomy.json';
import type { SurveyResponse, Taxonomy } from '../lib/types';
import { fetchAllResponses, ApiError } from '../lib/api';
import {
  computeClusterAnalysis,
  computePriorityTopics,
  computeToolPracticeCorrelations,
  computeCrossTab,
} from '../lib/analytics';
import { Card, Notice } from '../components/ui';

const taxonomy = taxonomyData as unknown as Taxonomy;
const CLUSTER_COLORS = ['#12305C', '#A12C7B', '#437A22', '#9C6A1E'];

function priorityColor(p: number): string {
  if (p >= 0.66) return '#A12C2C';
  if (p >= 0.4) return '#9C6A1E';
  return '#3E7A3E';
}

export default function AdminAnalysisPage() {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [instituteFilter, setInstituteFilter] = useState<string>('');
  const [directionFilter, setDirectionFilter] = useState<string>('');
  const [profileFilter, setProfileFilter] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchAllResponses();
        setResponses(data);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Не удалось загрузить данные анкет.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return responses.filter(
      (r) =>
        (!instituteFilter || r.institute === instituteFilter) &&
        (!directionFilter || r.direction === directionFilter) &&
        (!profileFilter || r.profile === profileFilter)
    );
  }, [responses, instituteFilter, directionFilter, profileFilter]);

  const institutes = useMemo(() => Array.from(new Set(responses.map((r) => r.institute).filter(Boolean))), [responses]);
  const directions = useMemo(() => Array.from(new Set(responses.map((r) => r.direction).filter(Boolean))), [responses]);
  const profiles = useMemo(() => Array.from(new Set(responses.map((r) => r.profile).filter(Boolean))), [responses]);

  const clusterResult = useMemo(() => computeClusterAnalysis(taxonomy, filtered), [filtered]);
  const priorityTopics = useMemo(() => computePriorityTopics(taxonomy, filtered, 15), [filtered]);
  const correlations = useMemo(() => computeToolPracticeCorrelations(taxonomy, filtered), [filtered]);
  const crossTabInstitute = useMemo(() => computeCrossTab(taxonomy, filtered, 'institute'), [filtered]);
  const crossTabDirection = useMemo(() => computeCrossTab(taxonomy, filtered, 'direction'), [filtered]);
  const crossTabProfile = useMemo(() => computeCrossTab(taxonomy, filtered, 'profile'), [filtered]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <p className="text-muted text-sm">Загрузка данных…</p>
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl text-navy-dark mb-1">Групповой анализ</h1>
        <p className="text-sm text-muted">
          Углублённая аналитика по {filtered.length} из {responses.length} анкет — для планирования учебного
          процесса, лекционного материала, персональных траекторий и заданий.
        </p>
      </div>

      {/* Фильтры */}
      <Card className="mb-6">
        <h2 className="font-display text-base text-navy-dark mb-3">Фильтры</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <label className="block">
            <span className="block text-xs font-medium text-muted mb-1">Институт</span>
            <select
              value={instituteFilter}
              onChange={(e) => setInstituteFilter(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-white"
            >
              <option value="">Все институты</option>
              {institutes.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted mb-1">Направление</span>
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-white"
            >
              <option value="">Все направления</option>
              {directions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted mb-1">Профиль</span>
            <select
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-white"
            >
              <option value="">Все профили</option>
              {profiles.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Нет анкет, соответствующих выбранным фильтрам.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Кластерный анализ */}
          <Card>
            <h2 className="font-display text-lg text-navy-dark mb-1">
              Кластеры участников (k-means, k = {clusterResult.k || '—'})
            </h2>
            <p className="text-sm text-muted mb-4">
              Группировка по форме профиля компетенций (9 блоков A–I) — не по общему уровню, а по тому, где именно
              каждая подгруппа сильна и слаба. Основа для дифференцированных траекторий и заданий.
            </p>
            {clusterResult.note ? (
              <Notice kind="info">{clusterResult.note}</Notice>
            ) : (
              <div className="grid md:grid-cols-2 gap-5">
                {clusterResult.clusters.map((c, idx) => (
                  <div key={c.clusterId} className="rounded-lg border border-border-light p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: CLUSTER_COLORS[idx % CLUSTER_COLORS.length] }}
                      >
                        Кластер {idx + 1} · {c.size} чел.
                      </span>
                      <span className="text-xs text-muted">Мотивация: {c.avgMotivation.toFixed(1)}/5</span>
                    </div>
                    <p className="text-sm text-ink mb-3">{c.label}</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart data={c.centroid}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="code" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9 }} />
                        <Radar
                          dataKey="average"
                          stroke={CLUSTER_COLORS[idx % CLUSTER_COLORS.length]}
                          fill={CLUSTER_COLORS[idx % CLUSTER_COLORS.length]}
                          fillOpacity={0.3}
                        />
                        <Tooltip formatter={((v: number) => v.toFixed(2)) as unknown as (value: unknown) => string} />
                      </RadarChart>
                    </ResponsiveContainer>
                    <div className="text-xs text-muted space-y-1 mt-2">
                      {c.topTools.length > 0 && (
                        <p>
                          <span className="font-medium text-ink">Часто используют:</span>{' '}
                          {c.topTools.map((t) => `${t.label} (${t.pct.toFixed(0)}%)`).join(', ')}
                        </p>
                      )}
                      {c.topDesiredBlocks.length > 0 && (
                        <p>
                          <span className="font-medium text-ink">Хотят изучать:</span>{' '}
                          {c.topDesiredBlocks.map((b) => `${b.code} (${b.pct.toFixed(0)}%)`).join(', ')}
                        </p>
                      )}
                      <p>
                        <span className="font-medium text-ink">Состав:</span>{' '}
                        {c.members.map((m) => m.fio || m.telegram).join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Приоритизация тем */}
          <Card>
            <h2 className="font-display text-lg text-navy-dark mb-1">Приоритизация тем для программы</h2>
            <p className="text-sm text-muted mb-4">
              Приоритет = 50% пробел (низкий балл) + 30% доля желающих изучать блок + 20% разброс ответов (чем выше
              разброс — тем нужнее дифференциация внутри темы). Темы для первоочередного включения в лекции и
              вводные модули.
            </p>
            <div className="space-y-2">
              {priorityTopics.map((t, idx) => (
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
                    <p className="text-xs text-muted mt-1">
                      Балл {t.average.toFixed(2)} (σ={t.std.toFixed(2)}) · хотят изучать {t.desiredPct.toFixed(0)}%
                      анкет · дисциплины: {t.disciplines.map((d) => taxonomy.disciplines[d]?.code || d).join(', ')}
                    </p>
                  </div>
                  <span
                    className="font-display text-lg font-semibold shrink-0"
                    style={{ color: priorityColor(t.priority) }}
                  >
                    {(t.priority * 100).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Корреляции */}
          <Card>
            <h2 className="font-display text-lg text-navy-dark mb-1">
              Связь инструментов и практик с компетенциями
            </h2>
            <p className="text-sm text-muted mb-4">
              Корреляция Пирсона между использованием инструмента/практики и средним баллом по блоку. Положительная
              связь — инструмент действительно сопровождается более высокой самооценкой знаний; отсутствие связи —
              сигнал о поверхностном использовании без понимания.
            </p>
            {correlations.note ? (
              <Notice kind="info">{correlations.note}</Notice>
            ) : correlations.entries.length === 0 ? (
              <p className="text-sm text-muted">Значимых корреляций (|r| ≥ 0.3) не обнаружено на текущих данных.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border-light">
                      <th className="py-2 pr-3">Фактор</th>
                      <th className="py-2 pr-3">Тип</th>
                      <th className="py-2 pr-3">Блок</th>
                      <th className="py-2 pr-3">r</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correlations.entries.map((e, i) => (
                      <tr key={i} className="border-b border-border-light/60">
                        <td className="py-1.5 pr-3">{e.factorLabel}</td>
                        <td className="py-1.5 pr-3 text-xs text-muted">
                          {e.factorType === 'tool' ? 'инструмент' : 'практика'}
                        </td>
                        <td className="py-1.5 pr-3">
                          {e.blockCode} — {e.blockTitle}
                        </td>
                        <td
                          className="py-1.5 pr-3 font-semibold"
                          style={{ color: e.r > 0 ? '#3E7A3E' : '#A12C2C' }}
                        >
                          {e.r > 0 ? '+' : ''}
                          {e.r.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Кросс-таблицы */}
          <Card>
            <h2 className="font-display text-lg text-navy-dark mb-1">Кросс-таблицы по составу когорты</h2>
            <p className="text-sm text-muted mb-4">
              Средний балл по блокам в разрезе институтов, направлений и профилей — показывает, объясняется ли
              разброс компетенций происхождением поступающих (важно для входного уровня набора и профориентации).
            </p>
            <div className="space-y-5">
              <CrossTabTable title="По институту" groups={crossTabInstitute} />
              <CrossTabTable title="По направлению" groups={crossTabDirection} />
              <CrossTabTable title="По профилю" groups={crossTabProfile} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function CrossTabTable({
  title,
  groups,
}: {
  title: string;
  groups: ReturnType<typeof computeCrossTab>;
}) {
  if (groups.length <= 1) return null;
  return (
    <div>
      <h3 className="text-sm font-medium text-ink mb-2">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-faint border-b border-border-light">
              <th className="py-1.5 pr-3">Группа</th>
              <th className="py-1.5 pr-3">N</th>
              {taxonomy.blocks.map((b) => (
                <th key={b.code} className="py-1.5 pr-2">
                  {b.code}
                </th>
              ))}
              <th className="py-1.5 pr-2">Ø</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.value} className="border-b border-border-light/60">
                <td className="py-1.5 pr-3 text-ink">{g.value}</td>
                <td className="py-1.5 pr-3 text-muted">{g.count}</td>
                {g.blockAverages.map((b) => (
                  <td key={b.code} className="py-1.5 pr-2">
                    {b.average.toFixed(1)}
                  </td>
                ))}
                <td className="py-1.5 pr-2 font-semibold">{g.overallAverage.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
