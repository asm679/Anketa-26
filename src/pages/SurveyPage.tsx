import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import taxonomyData from '../content/taxonomy.json';
import type { Taxonomy, SurveyResponse } from '../lib/types';
import { TOOLS, PRACTICE, normalizeTelegram } from '../lib/types';
import { lookupResponse, submitResponse, ApiError } from '../lib/api';
import { useUiChrome } from '../lib/UiChrome';
import {
  ProgressBar,
  Notice,
  Card,
  ScaleSelector,
  ScaleLegend,
  PrimaryButton,
  SecondaryButton,
  TextField,
  TextArea,
} from '../components/ui';

const taxonomy = taxonomyData as unknown as Taxonomy;

// Адрес сайта анкетирования — используется для QR-кода и текстовой ссылки
// на странице авторизации, чтобы студенты могли быстро открыть анкету со
// своего телефона, отсканировав код с проекционного экрана.
const SURVEY_URL = 'http://z99392ok.beget.tech/';

type Step = 'lookup' | 'auth' | 'blocks' | 'tools' | 'desired' | 'extra' | 'review' | 'done';

const MOTIVATION_LABELS = [
  '1 — совсем не мотивирован(а)',
  '2 — скорее не мотивирован(а)',
  '3 — нейтрально',
  '4 — скорее мотивирован(а)',
  '5 — очень высокая мотивация',
];

interface FormState {
  telegram: string;
  fio: string;
  direction: string;
  profile: string;
  institute: string;
  email: string;
  consent152fz: boolean;
  scores: Record<string, number>;
  tools: Record<string, boolean>;
  practice: Record<string, boolean>;
  background: {
    bachelorDirection: string;
    bachelorProfile: string;
    experienceYears: string;
    programmingLanguages: string;
    studyPlace: string;
  };
  desiredBlocks: string[];
  desiredBlocksOther: string;
  motivation: number;
  expectations: string;
}

function emptyForm(): FormState {
  return {
    telegram: '',
    fio: '',
    direction: '',
    profile: '',
    institute: '',
    email: '',
    consent152fz: false,
    scores: {},
    tools: {},
    practice: {},
    background: {
      bachelorDirection: '',
      bachelorProfile: '',
      experienceYears: '',
      programmingLanguages: '',
      studyPlace: '',
    },
    desiredBlocks: [],
    desiredBlocksOther: '',
    motivation: 0,
    expectations: '',
  };
}

const ALL_ITEM_IDS = taxonomy.blocks.flatMap((b) => b.items.map((i) => i.id));

export default function SurveyPage() {
  const [step, setStep] = useState<Step>('lookup');
  const [lookupTelegram, setLookupTelegram] = useState('');
  const [lookupFio, setLookupFio] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { setCompact } = useUiChrome();

  // Компактный режим (без подвала, с уменьшенной шапкой) только на странице
  // авторизации — чтобы весь экран, включая QR-код, помещался без прокрутки
  // при проекции 1024x768.
  useEffect(() => {
    setCompact(step === 'lookup');
    return () => setCompact(false);
  }, [step, setCompact]);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [blockIndex, setBlockIndex] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, blockIndex]);

  async function handleLookupSubmit() {
    setLookupError(null);
    const cleanTelegram = normalizeTelegram(lookupTelegram);
    if (!lookupFio.trim() || !cleanTelegram) {
      setLookupError('Укажите ФИО и имя пользователя в Телеграм.');
      return;
    }
    setLookupLoading(true);
    try {
      const res = await lookupResponse(cleanTelegram, lookupFio.trim());
      if (res.found && res.data) {
        const d = res.data;
        setForm({
          telegram: d.telegram,
          fio: d.fio,
          direction: d.direction || '',
          profile: d.profile || '',
          institute: d.institute || '',
          email: d.email || '',
          consent152fz: d.consent152fz,
          scores: d.scores || {},
          tools: d.tools || {},
          practice: d.practice || {},
          background: {
            bachelorDirection: d.background?.bachelorDirection || '',
            bachelorProfile: d.background?.bachelorProfile || '',
            experienceYears: d.background?.experienceYears || '',
            programmingLanguages: d.background?.programmingLanguages || '',
            studyPlace: d.background?.studyPlace || '',
          },
          desiredBlocks: d.desiredBlocks || [],
          desiredBlocksOther: d.desiredBlocksOther || '',
          motivation: d.motivation || 0,
          expectations: d.expectations || '',
        });
        setIsEditing(true);
      } else {
        setForm({ ...emptyForm(), telegram: cleanTelegram, fio: lookupFio.trim() });
        setIsEditing(false);
      }
      setStep('auth');
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setLookupError(e.message);
      } else {
        setLookupError('Не удалось выполнить проверку. Попробуйте ещё раз позже.');
      }
    } finally {
      setLookupLoading(false);
    }
  }

  function validateAuthStep(): string[] {
    const errs: string[] = [];
    if (!form.telegram.trim()) errs.push('Не указано имя пользователя в Телеграм.');
    if (!form.fio.trim()) errs.push('Не указано ФИО.');
    if (!form.direction.trim()) errs.push('Не указано направление подготовки.');
    if (!form.institute.trim()) errs.push('Не указан институт/факультет.');
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) errs.push('Некорректный адрес электронной почты.');
    if (!form.consent152fz) errs.push('Необходимо согласие на обработку персональных данных (152-ФЗ).');
    return errs;
  }

  function validateBlocksStep(): string[] {
    const missing = ALL_ITEM_IDS.filter((id) => form.scores[id] === undefined);
    if (missing.length > 0) {
      return [`Не заполнено ${missing.length} из ${ALL_ITEM_IDS.length} вопросов. Ответьте на все пункты анкеты.`];
    }
    return [];
  }

  function validateExtraStep(): string[] {
    const errs: string[] = [];
    if (!form.motivation || form.motivation < 1 || form.motivation > 5) {
      errs.push('Оцените уровень мотивации по шкале от 1 до 5.');
    }
    return errs;
  }

  function goNextFromAuth() {
    const errs = validateAuthStep();
    setValidationErrors(errs);
    if (errs.length === 0) setStep('blocks');
  }

  function goNextFromBlocks() {
    if (blockIndex < taxonomy.blocks.length - 1) {
      setBlockIndex(blockIndex + 1);
      return;
    }
    const errs = validateBlocksStep();
    setValidationErrors(errs);
    if (errs.length === 0) setStep('tools');
  }

  function goPrevFromBlocks() {
    if (blockIndex > 0) {
      setBlockIndex(blockIndex - 1);
    } else {
      setStep('auth');
    }
  }

  function goNextFromExtra() {
    const errs = validateExtraStep();
    setValidationErrors(errs);
    if (errs.length === 0) setStep('review');
  }

  async function handleFinalSubmit() {
    setSubmitError(null);
    setSubmitLoading(true);
    try {
      const payload: Omit<SurveyResponse, 'slug' | 'submittedAt' | 'updatedAt' | 'version'> = {
        telegram: normalizeTelegram(form.telegram),
        fio: form.fio.trim(),
        direction: form.direction.trim(),
        profile: form.profile.trim(),
        institute: form.institute.trim(),
        email: form.email.trim() || undefined,
        consent152fz: form.consent152fz,
        scores: form.scores,
        tools: form.tools,
        practice: form.practice,
        background: form.background,
        desiredBlocks: form.desiredBlocks,
        desiredBlocksOther: form.desiredBlocksOther.trim() || undefined,
        motivation: form.motivation,
        expectations: form.expectations.trim() || undefined,
      };
      await submitResponse(payload);
      setStep('done');
    } catch (e) {
      if (e instanceof ApiError) {
        setSubmitError(e.message);
      } else {
        setSubmitError('Не удалось отправить анкету. Проверьте соединение с интернетом и попробуйте снова.');
      }
    } finally {
      setSubmitLoading(false);
    }
  }

  const totalSteps = 4 + taxonomy.blocks.length; // auth + blocks(N) + tools + desired + extra (review не считаем)
  const progress = useMemo(() => {
    if (step === 'lookup') return 0;
    if (step === 'auth') return (1 / totalSteps) * 100;
    if (step === 'blocks') return ((2 + blockIndex) / totalSteps) * 100;
    if (step === 'tools') return ((2 + taxonomy.blocks.length) / totalSteps) * 100;
    if (step === 'desired') return ((3 + taxonomy.blocks.length) / totalSteps) * 100;
    if (step === 'extra') return ((4 + taxonomy.blocks.length) / totalSteps) * 100;
    if (step === 'review') return 96;
    return 100;
  }, [step, blockIndex, totalSteps]);

  return (
    <div className={clsx('max-w-3xl mx-auto px-4 sm:px-6', step === 'lookup' ? 'py-3' : 'py-8')}>
      {step !== 'lookup' && step !== 'done' && (
        <div className="mb-6">
          <ProgressBar value={progress} label="Прогресс заполнения анкеты" />
        </div>
      )}

      {step === 'lookup' && (
        <Card className="p-4 sm:p-5">
          <h1 className="font-display text-xl sm:text-2xl text-navy-dark mb-1.5">Анкетирование магистрантов</h1>
          <p className="text-sm text-muted mb-4">
            Укажите фамилию, имя, отчество и имя пользователя в Telegram. Если анкета от вас уже
            принята, вы сможете отредактировать ранее введённые ответы.
          </p>
          <div className="grid gap-3 mb-3">
            <TextField
              label="ФИО"
              value={lookupFio}
              onChange={setLookupFio}
              placeholder="Иванов Иван Иванович"
              required
            />
            <TextField
              label="Имя пользователя в Телеграм"
              value={lookupTelegram}
              onChange={setLookupTelegram}
              placeholder="nick_name или @nick_name"
              hint="Можно вводить с @ или без — знак будет убран автоматически"
              required
            />
          </div>
          {lookupError && (
            <div className="mb-3">
              <Notice kind="error">{lookupError}</Notice>
            </div>
          )}
          <PrimaryButton onClick={handleLookupSubmit} disabled={lookupLoading}>
            {lookupLoading ? 'Проверка…' : 'Продолжить'}
          </PrimaryButton>

          <div className="mt-5 pt-4 border-t border-border-light flex items-center gap-4">
            <img
              src="/qr/entry-qr.png"
              alt="QR-код для перехода к анкете"
              className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-md border border-border-light bg-white p-1"
              width={128}
              height={128}
            />
            <div className="min-w-0">
              <p className="text-sm text-muted mb-1">Откройте анкету со своего телефона — отсканируйте QR-код или перейдите по ссылке:</p>
              <p className="font-display text-lg sm:text-xl text-navy-dark font-semibold break-all leading-snug">
                {SURVEY_URL}
              </p>
            </div>
          </div>
        </Card>
      )}

      {step === 'auth' && (
        <Card>
          {isEditing && (
            <div className="mb-4">
              <Notice kind="info">
                По этому имени пользователя найдена ранее отправленная анкета. Вы можете отредактировать
                ответы — при сохранении будет обновлена та же анкета.
              </Notice>
            </div>
          )}
          <h2 className="font-display text-xl text-navy-dark mb-4">Сведения о магистранте</h2>
          <div className="grid gap-4">
            <TextField label="ФИО" value={form.fio} onChange={(v) => setForm({ ...form, fio: v })} required />
            <TextField
              label="Имя пользователя в Телеграм"
              value={form.telegram}
              onChange={(v) => setForm({ ...form, telegram: v })}
              hint="Можно вводить с @ или без — знак будет убран автоматически"
              required
            />
            <TextField
              label="Направление подготовки"
              value={form.direction}
              onChange={(v) => setForm({ ...form, direction: v })}
              placeholder="Например, Информационные системы и технологии"
              required
            />
            <TextField
              label="Профиль"
              value={form.profile}
              onChange={(v) => setForm({ ...form, profile: v })}
              placeholder="Например, Искусственный интеллект"
            />
            <TextField
              label="Институт / факультет"
              value={form.institute}
              onChange={(v) => setForm({ ...form, institute: v })}
              required
            />
            <TextField
              label="Электронная почта"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              placeholder="you@example.com"
              type="email"
              hint="Опционально, для обратной связи по результатам"
            />
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.consent152fz}
                onChange={(e) => setForm({ ...form, consent152fz: e.target.checked })}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                Я даю согласие на обработку персональных данных в соответствии с Федеральным законом
                №152-ФЗ «О персональных данных». <span className="text-error">*</span>
              </span>
            </label>
          </div>

          {validationErrors.length > 0 && (
            <div className="mt-4 space-y-2">
              {validationErrors.map((err, i) => (
                <Notice key={i} kind="error">
                  {err}
                </Notice>
              ))}
            </div>
          )}

          <div className="flex justify-between mt-6">
            <SecondaryButton onClick={() => setStep('lookup')}>Назад</SecondaryButton>
            <PrimaryButton onClick={goNextFromAuth}>Далее — вопросы анкеты</PrimaryButton>
          </div>
        </Card>
      )}

      {step === 'blocks' && (
        <BlockStep
          block={taxonomy.blocks[blockIndex]}
          blockNumber={blockIndex + 1}
          totalBlocks={taxonomy.blocks.length}
          scores={form.scores}
          onChange={(id, v) => setForm({ ...form, scores: { ...form.scores, [id]: v } })}
          onNext={goNextFromBlocks}
          onPrev={goPrevFromBlocks}
          errors={validationErrors}
        />
      )}

      {step === 'tools' && (
        <Card>
          <h2 className="font-display text-xl text-navy-dark mb-2">Инструменты и практический опыт</h2>
          <p className="text-sm text-muted mb-5">
            Отметьте инструменты ИИ, которыми вы пользовались, и виды практического опыта, который у
            вас есть. Можно не отмечать ничего — это не влияет на допуск к обучению.
          </p>

          <h3 className="font-medium text-ink mb-2">Инструменты искусственного интеллекта</h3>
          <div className="grid sm:grid-cols-2 gap-2 mb-6">
            {TOOLS.map((t) => (
              <label
                key={t.id}
                className="flex items-start gap-2 text-sm rounded-lg border border-border-light px-3 py-2 hover:bg-surface-alt cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!!form.tools[t.id]}
                  onChange={(e) => setForm({ ...form, tools: { ...form.tools, [t.id]: e.target.checked } })}
                  className="mt-0.5 h-4 w-4"
                />
                <span>{t.label}</span>
              </label>
            ))}
          </div>

          <h3 className="font-medium text-ink mb-2">Практический опыт</h3>
          <div className="grid sm:grid-cols-2 gap-2 mb-2">
            {PRACTICE.map((p) => (
              <label
                key={p.id}
                className="flex items-start gap-2 text-sm rounded-lg border border-border-light px-3 py-2 hover:bg-surface-alt cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!!form.practice[p.id]}
                  onChange={(e) =>
                    setForm({ ...form, practice: { ...form.practice, [p.id]: e.target.checked } })
                  }
                  className="mt-0.5 h-4 w-4"
                />
                <span>{p.label}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-between mt-6">
            <SecondaryButton
              onClick={() => {
                setBlockIndex(taxonomy.blocks.length - 1);
                setStep('blocks');
              }}
            >
              Назад
            </SecondaryButton>
            <PrimaryButton onClick={() => setStep('desired')}>Далее</PrimaryButton>
          </div>
        </Card>
      )}

      {step === 'desired' && (
        <Card>
          <h2 className="font-display text-xl text-navy-dark mb-2">Желаемые блоки для обучения</h2>
          <p className="text-sm text-muted mb-5">
            Отметьте блоки программы, изучению которых вы хотели бы уделить больше внимания в ходе
            курса. Это поможет скорректировать содержание занятий под интересы группы. Можно отметить
            любое количество блоков — это не влияет на допуск к обучению.
          </p>

          <div className="grid gap-2 mb-5">
            {taxonomy.blocks.map((b) => (
              <label
                key={b.code}
                className="flex items-start gap-3 text-sm rounded-lg border border-border-light px-3 py-2.5 hover:bg-surface-alt cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={form.desiredBlocks.includes(b.code)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      desiredBlocks: e.target.checked
                        ? [...form.desiredBlocks, b.code]
                        : form.desiredBlocks.filter((c) => c !== b.code),
                    })
                  }
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>
                  <span className="font-medium text-ink">Блок {b.code}.</span> {b.title}
                </span>
              </label>
            ))}
          </div>

          <TextArea
            label="Другие темы, которые вы хотели бы изучить (опционально)"
            value={form.desiredBlocksOther}
            onChange={(v) => setForm({ ...form, desiredBlocksOther: v })}
            placeholder="Например, конкретные инструменты, кейсы или направления, не вошедшие в список выше"
          />

          <div className="flex justify-between mt-6">
            <SecondaryButton onClick={() => setStep('tools')}>Назад</SecondaryButton>
            <PrimaryButton onClick={() => setStep('extra')}>Далее</PrimaryButton>
          </div>
        </Card>
      )}

      {step === 'extra' && (
        <Card>
          <h2 className="font-display text-xl text-navy-dark mb-4">Дополнительные сведения</h2>
          <div className="grid gap-4 mb-6">
            <TextField
              label="Направление бакалавриата"
              value={form.background.bachelorDirection}
              onChange={(v) => setForm({ ...form, background: { ...form.background, bachelorDirection: v } })}
            />
            <TextField
              label="Профиль бакалавриата"
              value={form.background.bachelorProfile}
              onChange={(v) => setForm({ ...form, background: { ...form.background, bachelorProfile: v } })}
            />
            <TextField
              label="Опыт работы (лет)"
              value={form.background.experienceYears}
              onChange={(v) => setForm({ ...form, background: { ...form.background, experienceYears: v } })}
              placeholder="Например, 2"
            />
            <TextField
              label="Языки программирования"
              value={form.background.programmingLanguages}
              onChange={(v) =>
                setForm({ ...form, background: { ...form.background, programmingLanguages: v } })
              }
              placeholder="Например, Python, C++"
            />
            <TextField
              label="Место обучения (вуз)"
              value={form.background.studyPlace}
              onChange={(v) => setForm({ ...form, background: { ...form.background, studyPlace: v } })}
            />
          </div>

          <h3 className="font-medium text-ink mb-2">
            Оцените свою мотивацию к обучению по направлению «Искусственный интеллект» <span className="text-error">*</span>
          </h3>
          <div className="grid gap-2 mb-6">
            {MOTIVATION_LABELS.map((label, i) => {
              const value = i + 1;
              return (
                <label
                  key={value}
                  className="flex items-center gap-2 text-sm rounded-lg border border-border-light px-3 py-2 hover:bg-surface-alt cursor-pointer"
                >
                  <input
                    type="radio"
                    name="motivation"
                    checked={form.motivation === value}
                    onChange={() => setForm({ ...form, motivation: value })}
                    className="h-4 w-4"
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>

          <TextArea
            label="Ваши ожидания от обучения (опционально)"
            value={form.expectations}
            onChange={(v) => setForm({ ...form, expectations: v })}
            placeholder="Расскажите, что вы ожидаете получить от обучения в магистратуре"
          />

          {validationErrors.length > 0 && (
            <div className="mt-4 space-y-2">
              {validationErrors.map((err, i) => (
                <Notice key={i} kind="error">
                  {err}
                </Notice>
              ))}
            </div>
          )}

          <div className="flex justify-between mt-6">
            <SecondaryButton onClick={() => setStep('desired')}>Назад</SecondaryButton>
            <PrimaryButton onClick={goNextFromExtra}>Далее — проверка и отправка</PrimaryButton>
          </div>
        </Card>
      )}

      {step === 'review' && (
        <Card>
          <h2 className="font-display text-xl text-navy-dark mb-4">Проверка данных перед отправкой</h2>
          <dl className="grid sm:grid-cols-2 gap-3 text-sm mb-6">
            <ReviewItem label="Telegram" value={form.telegram} />
            <ReviewItem label="ФИО" value={form.fio} />
            <ReviewItem label="Направление" value={form.direction} />
            <ReviewItem label="Профиль" value={form.profile || '—'} />
            <ReviewItem label="Институт" value={form.institute} />
            <ReviewItem label="Email" value={form.email || '—'} />
            <ReviewItem label="Отвечено вопросов" value={`${Object.keys(form.scores).length} из ${ALL_ITEM_IDS.length}`} />
            <ReviewItem
              label="Желаемые блоки"
              value={form.desiredBlocks.length ? form.desiredBlocks.join(', ') : '—'}
            />
            <ReviewItem label="Мотивация" value={form.motivation ? String(form.motivation) : '—'} />
          </dl>

          {submitError && (
            <div className="mb-4">
              <Notice kind="error">{submitError}</Notice>
            </div>
          )}

          <div className="flex justify-between">
            <SecondaryButton onClick={() => setStep('extra')}>Назад</SecondaryButton>
            <PrimaryButton onClick={handleFinalSubmit} disabled={submitLoading}>
              {submitLoading ? 'Отправка…' : isEditing ? 'Сохранить изменения' : 'Отправить анкету'}
            </PrimaryButton>
          </div>
        </Card>
      )}

      {step === 'done' && (
        <Card className="text-center py-12">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-success" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="font-display text-2xl text-navy-dark mb-2">
            {isEditing ? 'Изменения сохранены' : 'Анкета отправлена'}
          </h2>
          <p className="text-sm text-muted mb-6">
            Спасибо за участие! Ваши ответы от имени пользователя «{form.telegram}» успешно зафиксированы.
          </p>
          <SecondaryButton onClick={() => window.location.reload()}>Заполнить другую анкету</SecondaryButton>
        </Card>
      )}
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="text-ink font-medium">{value}</dd>
    </div>
  );
}

function BlockStep({
  block,
  blockNumber,
  totalBlocks,
  scores,
  onChange,
  onNext,
  onPrev,
  errors,
}: {
  block: Taxonomy['blocks'][number];
  blockNumber: number;
  totalBlocks: number;
  scores: Record<string, number>;
  onChange: (id: string, v: number) => void;
  onNext: () => void;
  onPrev: () => void;
  errors: string[];
}) {
  const answeredInBlock = block.items.filter((i) => scores[i.id] !== undefined).length;
  return (
    <Card>
      <div className="mb-4">
        <span className="inline-block text-xs font-semibold text-gold bg-gold/10 rounded-full px-2.5 py-1 mb-2">
          Блок {block.code} · {blockNumber} из {totalBlocks}
        </span>
        <h2 className="font-display text-xl text-navy-dark mb-1">{block.title}</h2>
        <p className="text-sm text-muted">{block.intro}</p>
        <p className="text-xs text-faint mt-1">
          Отвечено {answeredInBlock} из {block.items.length} в этом блоке
        </p>
      </div>

      <ScaleLegend />

      <div className="space-y-5">
        {block.items.map((item) => (
          <div key={item.id} className="border-t border-border-light pt-4 first:border-t-0 first:pt-0">
            <p className="text-sm font-medium text-ink mb-1">
              <span className="text-faint mr-1">{item.id}</span>
              {item.short}
            </p>
            <p className="text-xs text-muted mb-3">{item.desc}</p>
            <ScaleSelector value={scores[item.id]} onChange={(v) => onChange(item.id, v)} name={item.id} />
          </div>
        ))}
      </div>

      {errors.length > 0 && (
        <div className="mt-4 space-y-2">
          {errors.map((err, i) => (
            <Notice key={i} kind="error">
              {err}
            </Notice>
          ))}
        </div>
      )}

      <div className="flex justify-between mt-6">
        <SecondaryButton onClick={onPrev}>Назад</SecondaryButton>
        <PrimaryButton onClick={onNext}>
          {blockNumber < totalBlocks ? 'Следующий блок' : 'Далее — инструменты'}
        </PrimaryButton>
      </div>
    </Card>
  );
}
