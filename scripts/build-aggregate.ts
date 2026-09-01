// Одноразовый скрипт: логинится в живой бэкенд, забирает все анкеты,
// считает анонимизированный агрегат через ту же логику, что и фронтенд
// (src/lib/analytics.ts), и сохраняет JSON для передачи в ИИ.
import { buildAnonymizedAggregate } from '../src/lib/analytics';
import taxonomyData from '../src/content/taxonomy.json' with { type: 'json' };
import type { Taxonomy, SurveyResponse } from '../src/lib/types';
import { writeFileSync } from 'node:fs';

const BASE = 'http://z99392ok.beget.tech';

async function main() {
  const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    Origin: BASE,
    Referer: `${BASE}/`,
    Accept: 'application/json',
  };
  const loginRes = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { ...commonHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'RUT8304' }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  const { token } = await loginRes.json();

  const respRes = await fetch(`${BASE}/api/admin/responses`, {
    headers: { ...commonHeaders, Authorization: `Bearer ${token}` },
  });
  if (!respRes.ok) throw new Error(`Fetch responses failed: ${respRes.status}`);
  const responses = (await respRes.json()) as SurveyResponse[];

  const taxonomy = taxonomyData as unknown as Taxonomy;
  const aggregate = buildAnonymizedAggregate(taxonomy, responses);

  writeFileSync(
    '/home/user/workspace/aggregate.json',
    JSON.stringify({ totalResponses: responses.length, aggregate }, null, 2)
  );
  console.log(`OK: ${responses.length} responses, aggregate written to /home/user/workspace/aggregate.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
