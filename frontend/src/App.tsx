import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '@clerk/clerk-react';
import ClerkApiBridge from './components/ClerkApiBridge';
import { configureApiAuth } from './lib/api';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Categories from './pages/Categories';
import Goals from './pages/Goals';
import TaxVision from './pages/TaxVision';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] text-gray-600">
      Carregando…
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setTokenReady(false);
      return;
    }
    configureApiAuth(() => getToken());
    let cancelled = false;
    void getToken().then((token) => {
      if (!cancelled) {
        setTokenReady(!!token);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  if (!isLoaded) {
    return <AuthLoading />;
  }
  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }
  if (!tokenReady) {
    return <AuthLoading />;
  }
  return <>{children}</>;
}

function SignedOutOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return <AuthLoading />;
  }
  if (isSignedIn) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ClerkApiBridge>
          <Toaster position="top-right" />
          <Routes>
            <Route
              path="/sign-in/*"
              element={
                <SignedOutOnlyRoute>
                  <SignInPage />
                </SignedOutOnlyRoute>
              }
            />
            <Route
              path="/sign-up/*"
              element={
                <SignedOutOnlyRoute>
                  <SignUpPage />
                </SignedOutOnlyRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="categories" element={<Categories />} />
              <Route path="goals" element={<Goals />} />
              <Route path="tax-vision" element={<TaxVision />} />
            </Route>
          </Routes>
        </ClerkApiBridge>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
