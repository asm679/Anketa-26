import { useEffect, useState } from 'react';
import type { AdminUser } from '../lib/types';
import { fetchUsers, createUser, updateUser, deleteUser, ApiError } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { Card, Notice, PrimaryButton, SecondaryButton, TextField } from '../components/ui';

interface UserFormState {
  id: string | null;
  username: string;
  password: string;
  role: 'admin' | 'viewer';
}

function emptyUserForm(): UserFormState {
  return { id: null, username: '', password: '', role: 'viewer' };
}

export default function AdminUsersPage() {
  const { role: myRole } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<UserFormState>(emptyUserForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = myRole === 'admin';

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить список пользователей.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm(emptyUserForm());
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(u: AdminUser) {
    setForm({ id: u.id, username: u.username, password: '', role: u.role });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    if (!form.username.trim()) {
      setFormError('Укажите имя пользователя.');
      return;
    }
    if (!form.id && !form.password.trim()) {
      setFormError('Укажите пароль для нового пользователя.');
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        const patch: { username?: string; password?: string; role?: 'admin' | 'viewer' } = {
          username: form.username.trim(),
          role: form.role,
        };
        if (form.password.trim()) patch.password = form.password.trim();
        await updateUser(form.id, patch);
      } else {
        await createUser(form.username.trim(), form.password.trim(), form.role);
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Не удалось сохранить пользователя.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u: AdminUser) {
    if (!window.confirm(`Удалить пользователя «${u.username}»?`)) return;
    try {
      await deleteUser(u.id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось удалить пользователя.');
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-navy-dark mb-1">Пользователи админ-панели</h1>
          <p className="text-sm text-muted">
            {canEdit
              ? 'Создание, редактирование и удаление учётных записей.'
              : 'Просмотр списка пользователей. Роль «наблюдатель» не может изменять записи.'}
          </p>
        </div>
        {canEdit && <PrimaryButton onClick={openCreate}>Добавить пользователя</PrimaryButton>}
      </div>

      {error && (
        <div className="mb-4">
          <Notice kind="error">{error}</Notice>
        </div>
      )}

      <Card>
        {loading ? (
          <p className="text-sm text-muted">Загрузка…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted">Пользователи не найдены.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-faint border-b border-border-light">
                  <th className="py-2 pr-4">Логин</th>
                  <th className="py-2 pr-4">Роль</th>
                  <th className="py-2 pr-4">Создан</th>
                  {canEdit && <th className="py-2 pr-4">Действия</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border-light/60">
                    <td className="py-2.5 pr-4 font-medium">{u.username}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={
                          u.role === 'admin'
                            ? 'inline-block text-xs rounded-full bg-navy-50 text-navy-dark px-2 py-0.5'
                            : 'inline-block text-xs rounded-full bg-surface-alt text-muted px-2 py-0.5'
                        }
                      >
                        {u.role === 'admin' ? 'администратор' : 'наблюдатель'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-faint">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('ru-RU') : '—'}
                    </td>
                    {canEdit && (
                      <td className="py-2.5 pr-4">
                        <div className="flex gap-2">
                          <SecondaryButton onClick={() => openEdit(u)} className="px-3 py-1.5 text-xs">
                            Изменить
                          </SecondaryButton>
                          <SecondaryButton onClick={() => handleDelete(u)} className="px-3 py-1.5 text-xs text-error">
                            Удалить
                          </SecondaryButton>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {formOpen && canEdit && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-card p-6 max-w-md w-full">
            <h2 className="font-display text-lg text-navy-dark mb-4">
              {form.id ? 'Редактирование пользователя' : 'Новый пользователь'}
            </h2>
            <div className="grid gap-4 mb-4">
              <TextField label="Логин" value={form.username} onChange={(v) => setForm({ ...form, username: v })} required />
              <TextField
                label={form.id ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль'}
                value={form.password}
                onChange={(v) => setForm({ ...form, password: v })}
                type="password"
                required={!form.id}
              />
              <label className="block">
                <span className="block text-sm font-medium text-ink mb-1">Роль</span>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'viewer' })}
                  className="w-full rounded-lg border border-border px-3 py-2.5 text-sm bg-white"
                >
                  <option value="viewer">Наблюдатель (только просмотр)</option>
                  <option value="admin">Администратор (полный доступ)</option>
                </select>
              </label>
            </div>
            {formError && (
              <div className="mb-4">
                <Notice kind="error">{formError}</Notice>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setFormOpen(false)}>Отмена</SecondaryButton>
              <PrimaryButton onClick={handleSave} disabled={saving}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
