import { getAssets, getLeases, getMortgages } from './lib/sheets';

export default async function Home() {
  const assets = await getAssets();
  const leases = await getLeases();
  const mortgages = await getMortgages();

  const totalAssets = assets.length;
  const totalValue = assets.reduce((sum, a) => sum + (parseFloat(a['Current Value']) || 0), 0);
  const totalRent = leases.reduce((sum, l) => sum + (parseFloat(l['Monthly Rent']) || 0), 0);
  const totalDebt = mortgages.reduce((sum, m) => sum + (parseFloat(m['Outstanding Balance']) || parseFloat(m['Original Principal']) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Portfolio Dashboard</h1>
      
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm text-slate-500">Total Assets</p>
          <p className="text-3xl font-bold text-slate-900">{totalAssets}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm text-slate-500">Portfolio Value</p>
          <p className="text-3xl font-bold text-emerald-600">€{totalValue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm text-slate-500">Monthly Rent</p>
          <p className="text-3xl font-bold text-blue-600">€{totalRent.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-sm text-slate-500">Total Debt</p>
          <p className="text-3xl font-bold text-orange-600">€{totalDebt.toLocaleString()}</p>
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Assets</h2>
        </div>
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Address</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Purchase Price</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Current Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {assets.map((asset, i) => (
              <tr key={i}>
                <td className="px-6 py-4 text-sm font-medium text-slate-900">{asset['Name']}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{asset['Address']}</td>
                <td className="px-6 py-4 text-sm text-slate-900 text-right">€{parseFloat(asset['Purchase Price'] || '0').toLocaleString()}</td>
                <td className="px-6 py-4 text-sm text-emerald-600 text-right font-medium">€{parseFloat(asset['Current Value'] || '0').toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}