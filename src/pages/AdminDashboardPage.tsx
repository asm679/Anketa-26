import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import taxonomyData from '../content/taxonomy.json';
import type { SurveyResponse, Taxonomy } from '../lib/types';
import { fetchAllResponses, ApiError } from '../lib/api';
import { computeBlockStats, type BlockStat, type ItemStat } from '../lib/analytics';
import { Card, Notice, SecondaryButton } from '../components/ui';

const taxonomy = taxonomyData as unknown as Taxonomy;

const BLOCK_COLORS = ['#12305C', '#2E4E7A', '#9C7A2A', '#3E7A3E', '#A12C2C', '#5B5F66', '#0B2142', '#D4B860', '#8A8E94'];

function scoreColor(avg: number): string {
  if (avg < 1.5) return '#A12C2C';
  if (avg < 2.5) return '#9C6A1E';
  if (avg < 3.3) return '#2E4E7A';
  return '#3E7A3E';
}

export default function AdminDashboardPage() {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<BlockStat | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemStat | null>(null);

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

  const blockStats = useMemo(() => computeBlockStats(taxonomy, responses), [responses]);

  const responsesForItem = useMemo(() => {
    if (!selectedItem) return [];
    return responses
      .filter((r) => typeof r.scores?.[selectedItem.id] === 'number')
      .map((r) => ({ telegram: r.telegram, fio: r.fio, score: r.scores[selectedItem.id] }))
      .sort((a, b) => a.score - b.score);
  }, [selectedItem, responses]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <p className="text-muted text-sm">Загрузка статистики…</p>
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
      <h1 className="font-display text-2xl text-navy-dark mb-1">Дашборд по анкетированию</h1>
      <p className="text-sm text-muted mb-6">
        Всего заполненных анкет: <strong>{responses.length}</strong>. Нажмите на блок для детализации по
        пунктам, затем на пункт — для распределения оценок и списка участников.
      </p>

      {responses.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Пока нет ни одной отправленной анкеты.</p>
        </Card>
      ) : !selectedBlock ? (
        <Card>
          <h2 className="font-medium text-ink mb-4">Средний балл по блокам (0–5)</h2>
          <ResponsiveContainer width="100%" height={Math.max(320, blockStats.length * 42)}>
            <BarChart data={blockStats} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="code"
                width={30}
                tick={{ fontSize: 13, fontWeight: 600 }}
              />
              <Tooltip
                formatter={((v: number) => v.toFixed(2)) as unknown as (value: unknown) => string}
                labelFormatter={((code: unknown) => taxonomy.blocks.find((b) => b.code === code)?.title || String(code)) as unknown as (label: unknown) => string}
              />
              <Bar
                dataKey="average"
                radius={[0, 4, 4, 0]}
                cursor="pointer"
                onClick={(data: unknown) => setSelectedBlock(data as BlockStat)}
              >
                {blockStats.map((b, i) => (
                  <Cell key={b.code} fill={BLOCK_COLORS[i % BLOCK_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="grid sm:grid-cols-3 md:grid-cols-3 gap-3 mt-6">
            {blockStats.map((b, i) => (
              <button
                key={b.code}
                onClick={() => setSelectedBlock(b)}
                className="text-left rounded-lg border border-border-light p-4 hover:border-navy-med hover:shadow-card transition-all"
                style={{ borderLeftColor: BLOCK_COLORS[i % BLOCK_COLORS.length], borderLeftWidth: 4 }}
              >
                <p className="text-xs text-faint mb-1">Блок {b.code}</p>
                <p className="text-sm font-medium text-ink mb-2 line-clamp-2">{b.title}</p>
                <p className="font-display text-2xl" style={{ color: scoreColor(b.average) }}>
                  {b.average.toFixed(2)}
                </p>
              </button>
            ))}
          </div>
        </Card>
      ) : !selectedItem ? (
        <Card>
          <SecondaryButton onClick={() => setSelectedBlock(null)} className="mb-4">
            ← Ко всем блокам
          </SecondaryButton>
          <h2 className="font-medium text-ink mb-1">
            Блок {selectedBlock.code}: {selectedBlock.title}
          </h2>
          <p className="text-sm text-muted mb-4">Средний балл по пунктам блока. Нажмите на пункт для деталей.</p>
          <ResponsiveContainer width="100%" height={Math.max(320, selectedBlock.items.length * 36)}>
            <BarChart data={selectedBlock.items} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="id" width={50} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={((v: number) => v.toFixed(2)) as unknown as (value: unknown) => string}
                labelFormatter={((id: unknown) => selectedBlock.items.find((i) => i.id === id)?.short || String(id)) as unknown as (label: unknown) => string}
              />
              <Bar
                dataKey="average"
                radius={[0, 4, 4, 0]}
                cursor="pointer"
                onClick={(data: unknown) => setSelectedItem(data as ItemStat)}
              >
                {selectedBlock.items.map((it) => (
                  <Cell key={it.id} fill={scoreColor(it.average)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 space-y-2">
            {selectedBlock.items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="w-full text-left flex items-center justify-between gap-3 rounded-lg border border-border-light px-4 py-2.5 hover:bg-surface-alt transition-colors"
              >
                <span className="text-sm text-ink">
                  <span className="text-faint mr-2">{item.id}</span>
                  {item.short}
                </span>
                <span className="font-display text-sm font-semibold shrink-0" style={{ color: scoreColor(item.average) }}>
                  {item.average.toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <SecondaryButton onClick={() => setSelectedItem(null)} className="mb-4">
            ← К пунктам блока {selectedBlock.code}
          </SecondaryButton>
          <p className="text-xs text-faint mb-1">{selectedItem.id}</p>
          <h2 className="font-medium text-ink mb-1">{selectedItem.short}</h2>
          <p className="text-sm text-muted mb-4">{selectedItem.desc}</p>

          <h3 className="text-sm font-medium text-ink mb-2">Распределение оценок (0–5)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={selectedItem.distribution.map((count, score) => ({ score: String(score), count }))}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="score" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#12305C" />
            </BarChart>
          </ResponsiveContainer>

          <h3 className="text-sm font-medium text-ink mt-6 mb-2">Список участников ({responsesForItem.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-faint border-b border-border-light">
                  <th className="py-2 pr-4">Telegram</th>
                  <th className="py-2 pr-4">ФИО</th>
                  <th className="py-2 pr-4">Оценка</th>
                </tr>
              </thead>
              <tbody>
                {responsesForItem.map((t) => (
                  <tr key={t.telegram} className="border-b border-border-light/60">
                    <td className="py-2 pr-4 font-medium">{t.telegram}</td>
                    <td className="py-2 pr-4">{t.fio}</td>
                    <td className="py-2 pr-4" style={{ color: scoreColor(t.score) }}>
                      {t.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
