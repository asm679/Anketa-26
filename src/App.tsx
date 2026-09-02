import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import { UiChromeProvider } from './lib/UiChrome';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import SurveyPage from './pages/SurveyPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminResponsesPage from './pages/AdminResponsesPage';
import AdminReportPage from './pages/AdminReportPage';
import AdminAnalysisPage from './pages/AdminAnalysisPage';
import AdminAiAnalysisPage from './pages/AdminAiAnalysisPage';

function App() {
  return (
    <UiChromeProvider>
    <AuthProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<SurveyPage />} />
            <Route path="/admin" element={<AdminLoginPage />} />
            <Route
              path="/admin/dashboard"
              element={
                <RequireAuth roles={['admin', 'viewer']}>
                  <AdminDashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireAuth roles={['admin']}>
                  <AdminUsersPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/responses"
              element={
                <RequireAuth roles={['admin', 'viewer']}>
                  <AdminResponsesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/report"
              element={
                <RequireAuth roles={['admin', 'viewer']}>
                  <AdminReportPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/analysis"
              element={
                <RequireAuth roles={['admin', 'viewer']}>
                  <AdminAnalysisPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/ai"
              element={
                <RequireAuth roles={['admin', 'viewer']}>
                  <AdminAiAnalysisPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<SurveyPage />} />
          </Routes>
        </Layout>
      </HashRouter>
    </AuthProvider>
    </UiChromeProvider>
  );
}

export default App;
