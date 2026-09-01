// Вспомогательные функции агрегации данных анкет для дашборда и отчёта.
import type { SurveyResponse, Taxonomy, TaxonomyBlock } from './types';
import { TOOLS, PRACTICE } from './types';

export interface ItemStat {
  id: string;
  short: string;
  desc: string;
  blockCode: string;
  average: number;
  count: number;
  distribution: number[]; // индекс = оценка 0..5, значение = количество ответов
}

export interface BlockStat {
  code: string;
  title: string;
  average: number;
  count: number;
  items: ItemStat[];
}

export function computeBlockStats(
  taxonomy: Taxonomy,
  responses: SurveyResponse[]
): BlockStat[] {
  return taxonomy.blocks.map((block: TaxonomyBlock) => {
    const items: ItemStat[] = block.items.map((item) => {
      const values: number[] = [];
      const distribution = [0, 0, 0, 0, 0, 0];
      for (const r of responses) {
        const v = r.scores?.[item.id];
        if (typeof v === 'number' && v >= 0 && v <= 5) {
          values.push(v);
          distribution[v] += 1;
        }
      }
      const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return {
        id: item.id,
        short: item.short,
        desc: item.desc,
        blockCode: block.code,
        average,
        count: values.length,
        distribution,
      };
    });
    const blockValues = items.filter((i) => i.count > 0);
    const average = blockValues.length
      ? blockValues.reduce((a, b) => a + b.average, 0) / blockValues.length
      : 0;
    return {
      code: block.code,
      title: block.title,
      average,
      count: responses.length,
      items,
    };
  });
}

export function computeResponseBlockProfile(
  taxonomy: Taxonomy,
  response: SurveyResponse
): { code: string; title: string; average: number }[] {
  return taxonomy.blocks.map((block) => {
    const values = block.items
      .map((item) => response.scores?.[item.id])
      .filter((v): v is number => typeof v === 'number');
    const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return { code: block.code, title: block.title, average };
  });
}

export interface RecommendedTopic {
  id: string;
  short: string;
  blockCode: string;
  blockTitle: string;
  average: number;
  disciplines: string[];
}

export function computeRecommendedTopics(
  taxonomy: Taxonomy,
  responses: SurveyResponse[],
  limit = 15
): RecommendedTopic[] {
  const stats = computeBlockStats(taxonomy, responses);
  const all: RecommendedTopic[] = [];
  for (const block of stats) {
    const taxBlock = taxonomy.blocks.find((b) => b.code === block.code);
    const disciplines = taxBlock ? [...taxBlock.primary, ...taxBlock.secondary] : [];
    for (const item of block.items) {
      if (item.count === 0) continue;
      all.push({
        id: item.id,
        short: item.short,
        blockCode: block.code,
        blockTitle: block.title,
        average: item.average,
        disciplines,
      });
    }
  }
  return all.sort((a, b) => a.average - b.average).slice(0, limit);
}

export function overallAverage(responses: SurveyResponse[]): number {
  const all: number[] = [];
  for (const r of responses) {
    for (const v of Object.values(r.scores || {})) {
      if (typeof v === 'number') all.push(v);
    }
  }
  return all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
}

export function toolsUsageStats(
  responses: SurveyResponse[],
  toolIds: string[]
): { id: string; count: number; pct: number }[] {
  const total = responses.length || 1;
  return toolIds.map((id) => {
    const count = responses.filter((r) => r.tools?.[id]).length;
    return { id, count, pct: (count / total) * 100 };
  });
}

export function practiceUsageStats(
  responses: SurveyResponse[],
  practiceIds: string[]
): { id: string; count: number; pct: number }[] {
  const total = responses.length || 1;
  return practiceIds.map((id) => {
    const count = responses.filter((r) => r.practice?.[id]).length;
    return { id, count, pct: (count / total) * 100 };
  });
}

export function desiredBlocksStats(
  taxonomy: Taxonomy,
  responses: SurveyResponse[]
): { code: string; title: string; count: number; pct: number }[] {
  const total = responses.length || 1;
  return taxonomy.blocks.map((block) => {
    const count = responses.filter((r) => (r.desiredBlocks || []).includes(block.code)).length;
    return { code: block.code, title: block.title, count, pct: (count / total) * 100 };
  });
}

export function motivationDistribution(responses: SurveyResponse[]): number[] {
  const dist = [0, 0, 0, 0, 0, 0]; // индекс 0 не используется, 1..5
  for (const r of responses) {
    if (r.motivation >= 1 && r.motivation <= 5) dist[r.motivation] += 1;
  }
  return dist;
}

// ============================================================================
// ГРУППОВОЙ АНАЛИЗ: кластеризация, приоритизация тем, корреляции, кросс-таблицы
// ============================================================================
// Методика (см. пояснение для педагога в отчёте):
// 1. Кластеризация k-means по 9-мерному вектору средних баллов блоков A–I —
//    выявляет не общий «уровень», а ФОРМУ профиля (кто силён в архитектурах,
//    но слаб в инфраструктуре, и наоборот) — основа для персональных траекторий.
// 2. Приоритизация тем = пробел (низкий балл) × желание изучать × разброс —
//    отличает «тема слабая и невостребованная» от «тема слабая и остро нужная».
// 3. Корреляции Пирсона между использованием инструментов/практик и баллами по
//    блокам — показывает, какие инструменты реально связаны с более высокой
//    самооценкой компетенций, а какие — нет (сигнал о поверхностном использовании).
// 4. Кросс-таблицы по институту/направлению/профилю — проверяют, объясняется ли
//    разброс компетенций составом когорты (важно для входного уровня набора).

function basicStats(values: number[]): { mean: number; std: number; n: number } {
  const n = values.length;
  if (n === 0) return { mean: 0, std: 0, n: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n;
  return { mean, std: Math.sqrt(variance), n };
}

// Коэффициент корреляции Пирсона между двумя рядами одинаковой длины.
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 4 || ys.length !== n) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  if (dx2 === 0 || dy2 === 0) return null;
  return num / Math.sqrt(dx2 * dy2);
}

// ---- Приоритизация тем: пробел + желание изучать + разброс ----

export interface PriorityTopic {
  id: string;
  short: string;
  blockCode: string;
  blockTitle: string;
  average: number;
  std: number;
  desiredPct: number; // доля анкет, отметивших блок этой темы как желаемый
  disciplines: string[];
  priority: number; // 0..1, выше — важнее включить в программу
}

export function computePriorityTopics(
  taxonomy: Taxonomy,
  responses: SurveyResponse[],
  limit = 15
): PriorityTopic[] {
  const total = responses.length || 1;
  const desiredPctByBlock: Record<string, number> = {};
  for (const block of taxonomy.blocks) {
    const count = responses.filter((r) => (r.desiredBlocks || []).includes(block.code)).length;
    desiredPctByBlock[block.code] = (count / total) * 100;
  }

  const all: PriorityTopic[] = [];
  for (const block of taxonomy.blocks) {
    const disciplines = [...block.primary, ...block.secondary];
    for (const item of block.items) {
      const values: number[] = [];
      for (const r of responses) {
        const v = r.scores?.[item.id];
        if (typeof v === 'number') values.push(v);
      }
      if (values.length === 0) continue;
      const { mean, std } = basicStats(values);
      const gapNorm = Math.max(0, Math.min(1, (5 - mean) / 5));
      const desiredPct = desiredPctByBlock[block.code] || 0;
      const desireNorm = Math.max(0, Math.min(1, desiredPct / 100));
      const spreadNorm = Math.max(0, Math.min(1, std / 2.5));
      const priority = 0.5 * gapNorm + 0.3 * desireNorm + 0.2 * spreadNorm;
      all.push({
        id: item.id,
        short: item.short,
        blockCode: block.code,
        blockTitle: block.title,
        average: mean,
        std,
        desiredPct,
        disciplines,
        priority,
      });
    }
  }
  return all.sort((a, b) => b.priority - a.priority).slice(0, limit);
}

// ---- Кластеризация k-means по профилю компетенций (средние баллы блоков A–I) ----

export interface ClusterInfo {
  clusterId: number;
  size: number;
  members: { telegram: string; fio: string }[];
  centroid: { code: string; title: string; average: number }[];
  strongestBlocks: { code: string; title: string; average: number }[];
  weakestBlocks: { code: string; title: string; average: number }[];
  topTools: { id: string; label: string; pct: number }[];
  topPractice: { id: string; label: string; pct: number }[];
  topDesiredBlocks: { code: string; title: string; pct: number }[];
  avgMotivation: number;
  label: string;
}

export interface ClusterAnalysisResult {
  clusters: ClusterInfo[];
  k: number;
  note?: string;
}

function kmeansAssign(vectors: number[][], k: number, iterations = 60, restarts = 10): number[] {
  const n = vectors.length;
  const dim = vectors[0]?.length || 0;
  let bestLabels: number[] = new Array(n).fill(0);
  let bestInertia = Infinity;

  for (let restart = 0; restart < restarts; restart++) {
    // k-means++ инициализация центроидов
    const centroids: number[][] = [];
    const firstIdx = Math.floor(Math.random() * n);
    centroids.push([...vectors[firstIdx]]);
    while (centroids.length < k) {
      const distances = vectors.map((v) => {
        let minD = Infinity;
        for (const c of centroids) {
          let d = 0;
          for (let j = 0; j < dim; j++) d += (v[j] - c[j]) * (v[j] - c[j]);
          if (d < minD) minD = d;
        }
        return minD;
      });
      const sum = distances.reduce((a, b) => a + b, 0);
      if (sum === 0) {
        centroids.push([...vectors[Math.floor(Math.random() * n)]]);
        continue;
      }
      let r = Math.random() * sum;
      let idx = 0;
      for (let i = 0; i < distances.length; i++) {
        r -= distances[i];
        if (r <= 0) {
          idx = i;
          break;
        }
      }
      centroids.push([...vectors[idx]]);
    }

    let labels = new Array(n).fill(0);
    for (let it = 0; it < iterations; it++) {
      const newLabels = vectors.map((v) => {
        let best = 0;
        let bestD = Infinity;
        for (let c = 0; c < centroids.length; c++) {
          let d = 0;
          for (let j = 0; j < dim; j++) d += (v[j] - centroids[c][j]) * (v[j] - centroids[c][j]);
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        return best;
      });
      let changed = false;
      for (let i = 0; i < n; i++) {
        if (newLabels[i] !== labels[i]) changed = true;
      }
      labels = newLabels;
      // Пересчёт центроидов
      for (let c = 0; c < k; c++) {
        const members = vectors.filter((_, i) => labels[i] === c);
        if (members.length === 0) continue;
        const centroid = new Array(dim).fill(0);
        for (const m of members) {
          for (let j = 0; j < dim; j++) centroid[j] += m[j];
        }
        for (let j = 0; j < dim; j++) centroid[j] /= members.length;
        centroids[c] = centroid;
      }
      if (!changed && it > 0) break;
    }

    let inertia = 0;
    for (let i = 0; i < n; i++) {
      const c = centroids[labels[i]];
      for (let j = 0; j < dim; j++) inertia += (vectors[i][j] - c[j]) * (vectors[i][j] - c[j]);
    }
    if (inertia < bestInertia) {
      bestInertia = inertia;
      bestLabels = labels;
    }
  }
  return bestLabels;
}

export function computeClusterAnalysis(
  taxonomy: Taxonomy,
  responses: SurveyResponse[],
  kOverride?: number
): ClusterAnalysisResult {
  const n = responses.length;
  if (n < 4) {
    return { clusters: [], k: 0, note: 'Для содержательной кластеризации нужно минимум 4 заполненные анкеты. Пока анкет меньше — используйте профиль по участнику в разделе «Отчёт».' };
  }

  let k = kOverride || (n < 8 ? 2 : n < 15 ? 3 : 4);
  k = Math.max(2, Math.min(k, Math.min(4, n - 1)));

  const blockCodes = taxonomy.blocks.map((b) => b.code);
  const vectors = responses.map((r) =>
    taxonomy.blocks.map((block) => {
      const values = block.items
        .map((item) => r.scores?.[item.id])
        .filter((v): v is number => typeof v === 'number');
      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    })
  );

  const labels = kmeansAssign(vectors, k);

  const clusters: ClusterInfo[] = [];
  for (let c = 0; c < k; c++) {
    const idxs = labels.map((l, i) => (l === c ? i : -1)).filter((i) => i >= 0);
    if (idxs.length === 0) continue;
    const members = idxs.map((i) => responses[i]);

    const centroidVec = blockCodes.map((_, j) => {
      const vals = idxs.map((i) => vectors[i][j]);
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    const centroid = taxonomy.blocks.map((block, j) => ({
      code: block.code,
      title: block.title,
      average: centroidVec[j],
    }));
    const sortedByScore = [...centroid].sort((a, b) => b.average - a.average);
    const strongestBlocks = sortedByScore.slice(0, 2);
    const weakestBlocks = sortedByScore.slice(-2).reverse();

    const clusterTotal = members.length;
    const topTools = TOOLS.map((t) => ({
      id: t.id,
      label: t.label,
      pct: (members.filter((r) => r.tools?.[t.id]).length / clusterTotal) * 100,
    }))
      .filter((t) => t.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
    const topPractice = PRACTICE.map((p) => ({
      id: p.id,
      label: p.label,
      pct: (members.filter((r) => r.practice?.[p.id]).length / clusterTotal) * 100,
    }))
      .filter((p) => p.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
    const topDesiredBlocks = taxonomy.blocks
      .map((block) => ({
        code: block.code,
        title: block.title,
        pct: (members.filter((r) => (r.desiredBlocks || []).includes(block.code)).length / clusterTotal) * 100,
      }))
      .filter((b) => b.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
    const avgMotivation = members.reduce((a, r) => a + (r.motivation || 0), 0) / clusterTotal;

    const label = `Сильны в ${strongestBlocks.map((b) => b.code).join(', ')}; требуют внимания в ${weakestBlocks.map((b) => b.code).join(', ')}`;

    clusters.push({
      clusterId: c,
      size: clusterTotal,
      members: members.map((r) => ({ telegram: r.telegram, fio: r.fio })),
      centroid,
      strongestBlocks,
      weakestBlocks,
      topTools,
      topPractice,
      topDesiredBlocks,
      avgMotivation,
      label,
    });
  }

  clusters.sort((a, b) => b.size - a.size);
  return { clusters, k };
}

// ---- Корреляции: использование инструментов/практик vs баллы по блокам ----

export interface CorrelationEntry {
  factorId: string;
  factorLabel: string;
  factorType: 'tool' | 'practice';
  blockCode: string;
  blockTitle: string;
  r: number;
  n: number;
}

export function computeToolPracticeCorrelations(
  taxonomy: Taxonomy,
  responses: SurveyResponse[],
  minAbsR = 0.3
): { entries: CorrelationEntry[]; note?: string } {
  if (responses.length < 6) {
    return { entries: [], note: 'Для расчёта корреляций нужно минимум 6 анкет — статистика по меньшим выборкам ненадёжна.' };
  }
  const blockAverages = taxonomy.blocks.map((block) =>
    responses.map((r) => {
      const values = block.items
        .map((item) => r.scores?.[item.id])
        .filter((v): v is number => typeof v === 'number');
      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    })
  );

  const entries: CorrelationEntry[] = [];
  const factors: { id: string; label: string; type: 'tool' | 'practice'; series: number[] }[] = [
    ...TOOLS.map((t) => ({
      id: t.id,
      label: t.label,
      type: 'tool' as const,
      series: responses.map((r) => (r.tools?.[t.id] ? 1 : 0)),
    })),
    ...PRACTICE.map((p) => ({
      id: p.id,
      label: p.label,
      type: 'practice' as const,
      series: responses.map((r) => (r.practice?.[p.id] ? 1 : 0)),
    })),
  ];

  for (const factor of factors) {
    // Пропускаем факторы без вариативности (все 0 или все 1) — корреляция не определена.
    const sum = factor.series.reduce((a, b) => a + b, 0);
    if (sum === 0 || sum === factor.series.length) continue;
    taxonomy.blocks.forEach((block, bi) => {
      const r = pearsonCorrelation(factor.series, blockAverages[bi]);
      if (r !== null && Math.abs(r) >= minAbsR) {
        entries.push({
          factorId: factor.id,
          factorLabel: factor.label,
          factorType: factor.type,
          blockCode: block.code,
          blockTitle: block.title,
          r,
          n: factor.series.length,
        });
      }
    });
  }

  entries.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  return { entries: entries.slice(0, 20) };
}

// ---- Кросс-таблицы: институт / направление / профиль × баллы по блокам ----

export interface CrossTabGroup {
  value: string;
  count: number;
  blockAverages: { code: string; average: number }[];
  overallAverage: number;
}

export function computeCrossTab(
  taxonomy: Taxonomy,
  responses: SurveyResponse[],
  field: 'institute' | 'direction' | 'profile'
): CrossTabGroup[] {
  const groupsMap = new Map<string, SurveyResponse[]>();
  for (const r of responses) {
    const key = (r[field] || '—').trim() || '—';
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key)!.push(r);
  }
  const result: CrossTabGroup[] = [];
  for (const [value, group] of groupsMap.entries()) {
    const blockAverages = taxonomy.blocks.map((block) => {
      const values: number[] = [];
      for (const r of group) {
        for (const item of block.items) {
          const v = r.scores?.[item.id];
          if (typeof v === 'number') values.push(v);
        }
      }
      return { code: block.code, average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0 };
    });
    const allValues = blockAverages.map((b) => b.average).filter((v) => v > 0 || true);
    const overall = allValues.length ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;
    result.push({ value, count: group.length, blockAverages, overallAverage: overall });
  }
  return result.sort((a, b) => b.count - a.count);
}

// ---- Анонимизированная выгрузка агрегатов для передачи во внешний ИИ ----
// Никаких telegram/FIO/email — только агрегированные показатели по группе,
// достаточные для педагогических рекомендаций, но не позволяющие
// идентифицировать конкретного человека по одному сообщению.

export function buildAnonymizedAggregate(
  taxonomy: Taxonomy,
  responses: SurveyResponse[]
) {
  const blockStats = computeBlockStats(taxonomy, responses);
  const priorityTopics = computePriorityTopics(taxonomy, responses, 20);
  const clusterResult = computeClusterAnalysis(taxonomy, responses);
  const correlations = computeToolPracticeCorrelations(taxonomy, responses);
  const crossTabs = {
    institute: computeCrossTab(taxonomy, responses, 'institute'),
    direction: computeCrossTab(taxonomy, responses, 'direction'),
    profile: computeCrossTab(taxonomy, responses, 'profile'),
  };
  const toolsStats = toolsUsageStats(responses, TOOLS.map((t) => t.id));
  const practiceStats = practiceUsageStats(responses, PRACTICE.map((p) => p.id));
  const desiredBlocks = desiredBlocksStats(taxonomy, responses);
  const motivationDist = motivationDistribution(responses);

  return {
    totalResponses: responses.length,
    overallAverage: overallAverage(responses),
    blockStats: blockStats.map((b) => ({ code: b.code, title: b.title, average: b.average, itemCount: b.items.length })),
    priorityTopics: priorityTopics.map((t) => ({
      block: t.blockCode,
      blockTitle: t.blockTitle,
      topic: t.short,
      average: Number(t.average.toFixed(2)),
      std: Number(t.std.toFixed(2)),
      desiredPct: Number(t.desiredPct.toFixed(1)),
      priority: Number(t.priority.toFixed(3)),
      disciplines: t.disciplines,
    })),
    clusters: clusterResult.clusters.map((c) => ({
      size: c.size,
      strongestBlocks: c.strongestBlocks,
      weakestBlocks: c.weakestBlocks,
      topTools: c.topTools,
      topPractice: c.topPractice,
      topDesiredBlocks: c.topDesiredBlocks,
      avgMotivation: Number(c.avgMotivation.toFixed(2)),
    })),
    clusterNote: clusterResult.note,
    correlations: correlations.entries,
    correlationNote: correlations.note,
    crossTabs,
    toolsUsage: toolsStats.map((t) => ({ id: t.id, label: TOOLS.find((x) => x.id === t.id)?.label, pct: Number(t.pct.toFixed(1)) })),
    practiceUsage: practiceStats.map((p) => ({ id: p.id, label: PRACTICE.find((x) => x.id === p.id)?.label, pct: Number(p.pct.toFixed(1)) })),
    desiredBlocks: desiredBlocks.map((d) => ({ code: d.code, title: d.title, pct: Number(d.pct.toFixed(1)) })),
    motivationDistribution: motivationDist,
  };
}
