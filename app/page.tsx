import { getPortfolioData } from './lib/sheets';
import Dashboard from './components/Dashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  try {
    const data = await getPortfolioData();
    
    return (
      <Dashboard 
        initialAssets={data.assets}
        initialPipeline={data.pipeline}
        initialConfig={data.config}
      />
    );
  } catch (error) {
    console.error('Error loading portfolio:', error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Error Loading Portfolio</h1>
          <p className="text-slate-600 mb-4">Could not connect to Google Sheets. Please check your configuration.</p>
          <p className="text-xs text-slate-400">Make sure GOOGLE_CREDENTIALS environment variable is set correctly in Vercel.</p>
        </div>
      </div>
    );
  }
}
