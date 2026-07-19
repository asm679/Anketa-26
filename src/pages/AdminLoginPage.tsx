import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin, ApiError } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { Card, Notice, PrimaryButton, TextField } from '../components/ui';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) {
    navigate('/admin/dashboard', { replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password.trim()) {
      setError('Введите пароль.');
      return;
    }
    setLoading(true);
    try {
      const res = await adminLogin(username.trim() || 'admin', password);
      login(res.token, res.username, res.role);
      navigate('/admin/dashboard');
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('Не удалось выполнить вход. Проверьте соединение и попробуйте снова.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-16">
      <Card>
        <h1 className="font-display text-2xl text-navy-dark mb-2">Вход в админ-панель</h1>
        <p className="text-sm text-muted mb-6">
          Доступ только для сотрудников кафедры, ответственных за приём и анализ анкетирования.
        </p>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <TextField label="Логин" value={username} onChange={setUsername} placeholder="admin" />
          <TextField
            label="Пароль"
            value={password}
            onChange={setPassword}
            type="password"
            placeholder="••••••••"
            required
          />
          {error && <Notice kind="error">{error}</Notice>}
          <PrimaryButton type="submit" disabled={loading} className="w-full">
            {loading ? 'Проверка…' : 'Войти'}
          </PrimaryButton>
        </form>
      </Card>
    </div>
  );
}
