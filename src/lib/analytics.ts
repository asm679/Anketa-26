// Вспомогательные функции агрегации данных анкет для дашборда и отчёта.
import type { SurveyResponse, Taxonomy, TaxonomyBlock } from './types';

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

export function computeTicketBlockProfile(
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

export function motivationDistribution(responses: SurveyResponse[]): number[] {
  const dist = [0, 0, 0, 0, 0, 0]; // индекс 0 не используется, 1..5
  for (const r of responses) {
    if (r.motivation >= 1 && r.motivation <= 5) dist[r.motivation] += 1;
  }
  return dist;
}
