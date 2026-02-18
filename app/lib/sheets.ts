import { google } from 'googleapis';

const SPREADSHEET_ID = '1fMRxzM6KXjLs-S3SJDeZsdz8AXKdoMqvpp5BYfT7M4w';

async function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
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
  const cleaned = val.toString().replace(/[€,%\s]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function parseBoolean(val: string | undefined): boolean {
  if (!val) return false;
  return val.toLowerCase() === 'true' || val.toLowerCase() === 'yes' || val === '1';
}

export async function getPortfolioData(): Promise<PortfolioData> {
  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch Properties sheet
    const propertiesRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Properties!A2:S50',
    });

    // Fetch Pipeline sheet
    const pipelineRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Pipeline!A2:I20',
    });

    const propertiesRows = propertiesRes.data.values || [];
    const pipelineRows = pipelineRes.data.values || [];

    const assets: Asset[] = propertiesRows
      .filter(row => row[0]) // Has ID
      .map((row, index) => ({
        id: index + 1,
        name: row[1] || '',
        zone: row[2] || '',
        sqm: parseNumber(row[3]),
        purchasePrice: parseNumber(row[4]),
        txCosts: parseNumber(row[5]),
        capex: parseNumber(row[6]),
        totalBasis: parseNumber(row[7]),
        currentValue: parseNumber(row[8]),
        monthlyGross: parseNumber(row[9]),
        marketRent: parseNumber(row[10]),
        occupancy: parseNumber(row[11]),
        ibi: parseNumber(row[12]),
        community: parseNumber(row[13]),
        insurance: parseNumber(row[14]),
        loanBalance: parseNumber(row[15]),
        rate: parseNumber(row[16]),
        monthlyDS: parseNumber(row[17]),
        tenantType: row[18] || 'Traditional',
      }));

    const pipeline: PipelineDeal[] = pipelineRows
      .filter(row => row[0])
      .map((row, index) => ({
        id: `P${index + 1}`,
        name: row[1] || '',
        price: parseNumber(row[2]),
        estBasis: parseNumber(row[3]),
        arras: parseNumber(row[4]),
        paid: parseBoolean(row[5]),
        deadline: row[6] || null,
        estYield: parseNumber(row[7]),
        prob: parseNumber(row[8]),
      }));

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
