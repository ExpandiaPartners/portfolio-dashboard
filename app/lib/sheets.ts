import { google } from 'googleapis';

const SPREADSHEET_ID = '18gBd7snfKn8BR_OkdIKVdkmWpvdNlcyJtauK8JxLgAU';

async function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  
  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

export async function getAssets() {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Assets!A:L',
  });
  
  const rows = response.data.values || [];
  if (rows.length <= 1) return [];
  
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((header: string, i: number) => {
      obj[header] = row[i] || '';
    });
    return obj;
  });
}

export async function getLeases() {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Leases!A:M',
  });
  
  const rows = response.data.values || [];
  if (rows.length <= 1) return [];
  
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((header: string, i: number) => {
      obj[header] = row[i] || '';
    });
    return obj;
  });
}

export async function getMortgages() {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Mortgages!A:L',
  });
  
  const rows = response.data.values || [];
  if (rows.length <= 1) return [];
  
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((header: string, i: number) => {
      obj[header] = row[i] || '';
    });
    return obj;
  });
}