import { NextResponse } from 'next/server';
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, data } = body;

    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    switch (action) {
      case 'addAsset':
        return await addAsset(sheets, data);
      case 'updateAsset':
        return await updateAsset(sheets, data);
      case 'addLease':
        return await addLease(sheets, data);
      case 'addCapEx':
        return await addCapEx(sheets, data);
      case 'addOpEx':
        return await addOpEx(sheets, data);
      case 'addMortgage':
        return await addMortgage(sheets, data);
      case 'updateCell':
        return await updateCell(sheets, data);
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Update API Error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

async function addAsset(sheets: any, data: any) {
  // Get next ID
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Assets!A:A',
  });
  const nextId = (existing.data.values?.length || 1);

  // Calculate Total Basis
  const declaredPrice = data.declaredPrice || 0;
  const undeclaredAmount = data.undeclaredAmount || 0;
  const totalAcquisitionCost = declaredPrice + undeclaredAmount;
  const itp = declaredPrice * 0.10; // 10% ITP on declared
  const agencyFee = data.agencyFee || 0;
  const notaryRegistry = data.notaryRegistry || 0;
  const totalCapEx = data.totalCapEx || 0;
  const totalBasis = totalAcquisitionCost + itp + agencyFee + notaryRegistry + totalCapEx;

  const row = [
    nextId,
    data.name || '',
    data.address || '',
    data.zone || '',
    data.sqm || '',
    declaredPrice,
    data.purchaseDate || '',
    itp + agencyFee + notaryRegistry, // Tx Costs (total)
    totalCapEx,
    totalBasis,
    data.currentValue || totalBasis,
    (data.currentValue || totalBasis) - totalBasis, // Unrealized
    // Extended columns for detailed tracking
    undeclaredAmount,
    totalAcquisitionCost,
    itp,
    agencyFee,
    notaryRegistry
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Assets!A:Q',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });

  return NextResponse.json({ success: true, id: nextId, totalBasis });
}

async function updateAsset(sheets: any, data: any) {
  const { assetId, updates } = data;

  // Find the row with this asset ID
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Assets!A:A',
  });

  let rowIndex = -1;
  existing.data.values?.forEach((row: any[], index: number) => {
    if (row[0]?.toString() === assetId?.toString()) {
      rowIndex = index + 1; // 1-indexed for Sheets
    }
  });

  if (rowIndex === -1) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  // Update specific cells
  const updatePromises = Object.entries(updates).map(([column, value]) => {
    return sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Assets!${column}${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[value]] },
    });
  });

  await Promise.all(updatePromises);

  return NextResponse.json({ success: true, rowIndex });
}

async function addLease(sheets: any, data: any) {
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Leases!A:A',
  });
  const nextId = (existing.data.values?.length || 1);

  const row = [
    nextId,
    data.assetId || '',
    data.assetName || '',
    data.tenant || '',
    data.tenantId || '',
    data.monthlyRent || '',
    data.startDate || '',
    data.endDate || '',
    data.termMonths || '',
    data.deposit || '',
    data.indexation || '',
    data.status || 'Active',
    data.file || ''
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Leases!A:M',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });

  return NextResponse.json({ success: true, id: nextId });
}

async function addCapEx(sheets: any, data: any) {
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'CapEx!A:A',
  });
  const nextId = (existing.data.values?.length || 1);

  const row = [
    nextId,
    data.assetId || '',
    data.assetName || '',
    data.description || '',
    data.supplier || '',
    data.amount || '',
    data.date || '',
    data.invoiceNo || '',
    data.file || ''
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'CapEx!A:I',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });

  return NextResponse.json({ success: true, id: nextId });
}

async function addOpEx(sheets: any, data: any) {
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'OpEx!A:A',
  });
  const nextId = (existing.data.values?.length || 1);

  const row = [
    nextId,
    data.assetId || '',
    data.assetName || '',
    data.type || '',
    data.description || '',
    data.supplier || '',
    data.amount || '',
    data.frequency || 'Annual',
    data.year || new Date().getFullYear(),
    data.file || ''
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'OpEx!A:J',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });

  return NextResponse.json({ success: true, id: nextId });
}

async function addMortgage(sheets: any, data: any) {
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Mortgages!A:A',
  });
  const nextId = (existing.data.values?.length || 1);

  const row = [
    nextId,
    data.assetId || '',
    data.assetName || '',
    data.lender || '',
    data.originalPrincipal || '',
    data.outstandingBalance || '',
    data.interestRate || '',
    data.rateType || '',
    data.monthlyPayment || '',
    data.signingDate || '',
    data.termYears || '',
    data.file || ''
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Mortgages!A:L',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });

  return NextResponse.json({ success: true, id: nextId });
}

async function updateCell(sheets: any, data: any) {
  const { sheet, cell, value } = data;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!${cell}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });

  return NextResponse.json({ success: true });
}
