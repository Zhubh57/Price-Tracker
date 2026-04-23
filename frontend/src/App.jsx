import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <>
      {/* Global toast notification container */}
      <Toaster
        position="top-right"
        gutter={10}
        toastOptions={{
          style: {
            background: '#1a1a28',
            color:      '#f0f0f5',
            border:     '1px solid #1e1e2e',
            borderRadius: '0.75rem',
            fontSize:   '0.875rem',
            fontWeight: '500',
            boxShadow:  '0 20px 60px rgba(0,0,0,0.6)',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#1a1a28' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#1a1a28' },
          },
          loading: {
            iconTheme: { primary: '#6c63ff', secondary: '#1a1a28' },
          },
        }}
      />
      <Dashboard />
    </>
  );
}
