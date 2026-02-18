import { google } from 'googleapis';

const SPREADSHEET_ID = '18gBd7snfKn8BR_OkdIKVdkmWpvdNlcyJtauK8JxLgAU';

async function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  return auth;
}

export interface Asset {
  id: number;
  name: string;
  zone: string;
  sqm: number;
  purchasePrice: number;
  txCosts: number;
  capex: number;
  totalBasis: number;
  currentValue: number;
  monthlyGross: number;
  marketRent: number;
  occupancy: number;
  ibi: number;
  community: number;
  insurance: number;
  loanBalance: number;
  rate: number;
  monthlyDS: number;
  tenantType: string;
}

export interface PipelineDeal {
  id: string;
  name: string;
  price: number;
  estBasis: number;
  arras: number;
  paid: boolean;
  deadline: string | null;
  estYield: number;
  prob: number;
}

export interface PortfolioData {
  assets: Asset[];
  pipeline: PipelineDeal[];
  config: {
    name: string;
    reportDate: string;
    targetYield: number;
    targetCoC: number;
    targetDSCR: number;
    depreciationRate: number;
    constructionRatio: number;
    marginalTaxRate: number;
    rentalReduction: number;
  };
}

function parseNumber(val: string | undefined): number {
  if (!val) return 0;
  let cleaned = val.toString().replace(/[€%\s]/g, '');
  // Handle Spanish format: 1.234,56 -> 1234.56
  // If has both . and , then . is thousands separator and , is decimal
  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    // Only comma - it's decimal separator
    cleaned = cleaned.replace(',', '.');
  }
  // Remove any remaining dots that are thousands separators (e.g., 1.234 -> 1234)
  // Only if there's no decimal point after
  const parts = cleaned.split('.');
  if (parts.length === 2 && parts[1].length === 3 && !cleaned.includes(',')) {
    // This is likely 44.319 meaning 44319, not 44.319
    cleaned = cleaned.replace('.', '');
  }
  return parseFloat(cleaned) || 0;
}

export async function getPortfolioData(): Promise<PortfolioData> {
  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch all sheets in parallel
    const [assetsRes, leasesRes, opexRes, mortgagesRes] = await Promise.all([
      // Assets: ID, Name, Address, Zone, sqm, Purchase Price, Purchase Date, Tx Costs, Total CapEx, Total Basis, Current Value, Unrealised G/L
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Assets!A2:L50',
      }),
      // Leases: ID, Asset ID, Asset Name, Tenant, ID Number, Monthly Rent, Start Date, End Date, Term, Deposit, Indexation, Status, File
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Leases!A2:M50',
      }),
      // OpEx: ID, Asset ID, Asset Name, Type, Description, Supplier, Amount, Frequency, Year, File
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'OpEx!A2:J100',
      }),
      // Mortgages: ID, Asset ID, Asset Name, Lender, Original Principal, Outstanding Balance, Interest Rate, Rate Type, Monthly Payment, Signing Date, Term, File
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Mortgages!A2:L50',
      }),
    ]);

    const assetsRows = assetsRes.data.values || [];
    const leasesRows = leasesRes.data.values || [];
    const opexRows = opexRes.data.values || [];
    const mortgagesRows = mortgagesRes.data.values || [];

    // Build lookup maps by Asset ID
    // Leases: Asset ID is column B (index 1), Monthly Rent is column F (index 5), Status is column L (index 11)
    const leasesByAsset: Record<string, { monthlyRent: number; status: string }> = {};
    for (const row of leasesRows) {
      const assetId = row[1];
      if (assetId) {
        const status = row[11] || '';
        // Only count active leases
        if (status.toLowerCase() === 'active' || status.toLowerCase() === 'activo') {
          leasesByAsset[assetId] = {
            monthlyRent: parseNumber(row[5]),
            status: status,
          };
        }
      }
    }

    // OpEx: Asset ID is column B (index 1), Type is column D (index 3), Amount is column G (index 6), Frequency is column H (index 7)
    const opexByAsset: Record<string, { ibi: number; community: number; insurance: number }> = {};
    for (const row of opexRows) {
      const assetId = row[1];
      if (assetId) {
        if (!opexByAsset[assetId]) {
          opexByAsset[assetId] = { ibi: 0, community: 0, insurance: 0 };
        }
        const type = (row[3] || '').toLowerCase();
        let amount = parseNumber(row[6]);
        const frequency = (row[7] || '').toLowerCase();
        
        // Convert to annual if needed
        if (frequency === 'monthly' || frequency === 'mensual') {
          amount = amount * 12;
        } else if (frequency === 'quarterly' || frequency === 'trimestral') {
          amount = amount * 4;
        }
        // Annual/Anual stays as is

        if (type.includes('ibi') || type.includes('property tax')) {
          opexByAsset[assetId].ibi += amount;
        } else if (type.includes('community') || type.includes('comunidad')) {
          opexByAsset[assetId].community += amount;
        } else if (type.includes('insurance') || type.includes('seguro')) {
          opexByAsset[assetId].insurance += amount;
        }
      }
    }

    // Mortgages: Asset ID is column B (index 1), Outstanding Balance is column F (index 5), Interest Rate is column G (index 6), Monthly Payment is column I (index 8)
    const mortgagesByAsset: Record<string, { balance: number; rate: number; monthlyPayment: number }> = {};
    for (const row of mortgagesRows) {
      const assetId = row[1];
      if (assetId) {
        mortgagesByAsset[assetId] = {
          balance: parseNumber(row[5]),
          rate: parseNumber(row[6]),
          monthlyPayment: parseNumber(row[8]),
        };
      }
    }

    // Build assets array
    // Assets columns: ID(0), Name(1), Address(2), Zone(3), sqm(4), Purchase Price(5), Purchase Date(6), Tx Costs(7), Total CapEx(8), Total Basis(9), Current Value(10), Unrealised G/L(11)
    const assets: Asset[] = assetsRows
      .filter(row => row[0])
      .map((row, index) => {
        const assetId = row[0];
        const lease = leasesByAsset[assetId] || { monthlyRent: 0, status: '' };
        const opex = opexByAsset[assetId] || { ibi: 0, community: 0, insurance: 0 };
        const mortgage = mortgagesByAsset[assetId] || { balance: 0, rate: 0, monthlyPayment: 0 };

        const hasActiveLease = lease.monthlyRent > 0;
        
        return {
          id: index + 1,
          name: row[1] || '',
          zone: row[3] || '',
          sqm: parseNumber(row[4]),
          purchasePrice: parseNumber(row[5]),
          txCosts: parseNumber(row[7]),
          capex: parseNumber(row[8]),
          totalBasis: parseNumber(row[9]),
          currentValue: parseNumber(row[10]),
          monthlyGross: lease.monthlyRent,
          marketRent: lease.monthlyRent || 500, // Default market rent estimate
          occupancy: hasActiveLease ? 100 : 0,
          ibi: opex.ibi,
          community: opex.community,
          insurance: opex.insurance,
          loanBalance: mortgage.balance,
          rate: mortgage.rate,
          monthlyDS: mortgage.monthlyPayment,
          tenantType: hasActiveLease ? 'Traditional' : (mortgage.balance > 0 ? 'Refurb' : 'Vacant'),
        };
      });

    // No pipeline for now
    const pipeline: PipelineDeal[] = [];

    return {
      assets,
      pipeline,
      config: {
        name: "Deniz Saidov Real Estate Holdings",
        reportDate: new Date().toISOString().split('T')[0],
        targetYield: 0.12,
        targetCoC: 0.12,
        targetDSCR: 1.25,
        depreciationRate: 0.03,
        constructionRatio: 0.50,
        marginalTaxRate: 0.45,
        rentalReduction: 0.60,
      },
    };
  } catch (error) {
    console.error('Error fetching portfolio data:', error);
    throw error;
  }
}
