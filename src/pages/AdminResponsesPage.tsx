import { useEffect, useMemo, useRef, useState } from 'react';
import taxonomyData from '../content/taxonomy.json';
import type { SurveyResponse, Taxonomy } from '../lib/types';
import { fetchAllResponses, importResponses, deleteResponses, ApiError } from '../lib/api';
import { exportResponsesCsv, exportResponsesJson } from '../lib/export';
import { useAuth } from '../lib/AuthContext';
import { Card, Notice, SecondaryButton, TextField } from '../components/ui';

const taxonomy = taxonomyData as unknown as Taxonomy;
const ALL_ITEM_IDS = taxonomy.blocks.flatMap((b) => b.items.map((i) => i.id));

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AdminResponsesPage() {
  const { role } = useAuth();
  const canEdit = role === 'admin';

  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllResponses();
      data.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
      setResponses(data);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить список анкет.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return responses;
    return responses.filter(
      (r) =>
        r.fio.toLowerCase().includes(q) ||
        r.telegram.toLowerCase().includes(q) ||
        (r.institute || '').toLowerCase().includes(q) ||
        (r.direction || '').toLowerCase().includes(q)
    );
  }, [responses, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.slug));

  function toggleOne(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach((r) => next.delete(r.slug));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((r) => next.add(r.slug));
      return next;
    });
  }

  const selectedResponses = useMemo(
    () => responses.filter((r) => selected.has(r.slug)),
    [responses, selected]
  );

  function handleExportAllJson() {
    exportResponsesJson(responses);
  }

  function handleExportAllCsv() {
    exportResponsesCsv(responses, ALL_ITEM_IDS);
  }

  function handleExportSelectedJson() {
    exportResponsesJson(selectedResponses);
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    if (!window.confirm(`Удалить ${selected.size} выбранную(ые) анкету(ы)? Действие необратимо.`)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await deleteResponses({ slugs: Array.from(selected) });
      setNotice(`Удалено анкет: ${res.deleted}.`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось удалить выбранные анкеты.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAll() {
    if (responses.length === 0) return;
    if (
      !window.confirm(
        `Удалить ВСЕ ${responses.length} анкеты без возможности восстановления? Рекомендуется сначала экспортировать данные.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await deleteResponses({ all: true });
      setNotice(`Удалено анкет: ${res.deleted}.`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось удалить анкеты.');
    } finally {
      setBusy(false);
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setNotice(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list: SurveyResponse[] = Array.isArray(parsed) ? parsed : parsed?.responses;
      if (!Array.isArray(list)) {
        setError('Файл должен содержать JSON-массив анкет (или объект с полем "responses").');
        return;
      }
      if (
        !window.confirm(
          `Импортировать ${list.length} анкет(ы)? Существующие анкеты с тем же ником Telegram будут перезаписаны.`
        )
      ) {
        return;
      }
      setBusy(true);
      const res = await importResponses(list);
      setNotice(`Импортировано: ${res.imported}. Пропущено (неполные записи): ${res.skipped}.`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось разобрать или импортировать файл. Проверьте, что это корректный JSON-экспорт анкет.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl text-navy-dark mb-1">Заполненные анкеты</h1>
          <p className="text-sm text-muted">
            Всего: <strong>{responses.length}</strong>
            {search && <> · найдено: <strong>{filtered.length}</strong></>}
            {selected.size > 0 && <> · выбрано: <strong>{selected.size}</strong></>}
          </p>
        </div>
        <div className="w-full sm:w-64">
          <TextField label="" placeholder="Поиск по ФИО, нику, институту…" value={search} onChange={setSearch} />
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
      {notice && (
        <div className="mb-4">
          <Notice kind="success">{notice}</Notice>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SecondaryButton onClick={handleExportAllJson} disabled={responses.length === 0 || busy}>
          Экспорт всех (JSON)
        </SecondaryButton>
        <SecondaryButton onClick={handleExportAllCsv} disabled={responses.length === 0 || busy}>
          Экспорт всех (CSV)
        </SecondaryButton>
        <SecondaryButton onClick={handleExportSelectedJson} disabled={selected.size === 0 || busy}>
          Экспорт выбранных (JSON)
        </SecondaryButton>
        {canEdit && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              className="hidden"
            />
            <SecondaryButton onClick={handleImportClick} disabled={busy}>
              Импорт из JSON…
            </SecondaryButton>
            <span className="w-px h-6 bg-border-light mx-1" />
            <SecondaryButton
              onClick={handleDeleteSelected}
              disabled={selected.size === 0 || busy}
              className="text-error border-error/40 hover:bg-error/10"
            >
              Удалить выбранные
            </SecondaryButton>
            <SecondaryButton
              onClick={handleDeleteAll}
              disabled={responses.length === 0 || busy}
              className="text-error border-error/40 hover:bg-error/10"
            >
              Удалить все
            </SecondaryButton>
          </>
        )}
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <p className="text-sm text-muted p-5">Загрузка…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted p-5">
            {responses.length === 0 ? 'Пока нет ни одной отправленной анкеты.' : 'Ничего не найдено по запросу.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-faint border-b border-border-light bg-surface-alt">
                  {canEdit && (
                    <th className="py-2 pl-4 pr-2 w-8">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleAllFiltered}
                        className="h-4 w-4"
                        aria-label="Выбрать все"
                      />
                    </th>
                  )}
                  <th className="py-2 px-3">ФИО</th>
                  <th className="py-2 px-3">Ник в Telegram</th>
                  <th className="py-2 px-3">Институт</th>
                  <th className="py-2 px-3">Направление / профиль</th>
                  <th className="py-2 px-3">Заполнена</th>
                  <th className="py-2 px-3">Обновлена</th>
                  <th className="py-2 px-3 text-center">Версия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.slug} className="border-b border-border-light/60 hover:bg-surface-alt/60">
                    {canEdit && (
                      <td className="py-2 pl-4 pr-2">
                        <input
                          type="checkbox"
                          checked={selected.has(r.slug)}
                          onChange={() => toggleOne(r.slug)}
                          className="h-4 w-4"
                          aria-label={`Выбрать анкету ${r.fio}`}
                        />
                      </td>
                    )}
                    <td className="py-2 px-3 font-medium text-ink">{r.fio}</td>
                    <td className="py-2 px-3 text-muted">@{r.telegram}</td>
                    <td className="py-2 px-3 text-muted">{r.institute || '—'}</td>
                    <td className="py-2 px-3 text-muted">
                      {r.direction || '—'}
                      {r.profile ? ` / ${r.profile}` : ''}
                    </td>
                    <td className="py-2 px-3 text-faint whitespace-nowrap">{formatDateTime(r.submittedAt)}</td>
                    <td className="py-2 px-3 text-faint whitespace-nowrap">{formatDateTime(r.updatedAt)}</td>
                    <td className="py-2 px-3 text-center text-faint">{r.version ?? 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
