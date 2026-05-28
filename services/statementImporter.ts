import * as FileSystem from 'expo-file-system';
import { detectCurrency, parseAmount, detectDirection } from './currencyDetector';
import { parseSMS } from './smsParser';
import { isDuplicate } from './deduplicator';
import { enhanceTransaction } from './aiEngine';
import { insertTransaction, getAllTransactions, invalidateDailySummaryCache } from '../db/database';
import type { Transaction, ParsedTransaction } from '../types';

// ============================================================================
// Helpers
// ============================================================================

function generateTransactionId(): string {
  const random = Math.random().toString(36).substring(2);
  return `txn_${Date.now()}_${random.slice(0, 9)}`;
}

function getCurrencySymbol(code: string): string {
  const symbols: Record<string, string> = { 
    USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', 
    AUD: '$', CAD: '$', CAD_SYMBOL: '$', SAR: '﷼', AED: 'د.إ'
  };
  return symbols[code.toUpperCase()] || '$';
}

function extractMerchantSimple(text: string): string {
  if (!text) return 'Imported Transaction';
  const cleaned = text.replace(/[\d\-\.\/]+/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return 'Merchant';
  return words.slice(0, 2).join(' ');
}

// ============================================================================
// CSV Importer
// ============================================================================

export async function importCSV(filePath: string): Promise<Transaction[]> {
  const content = await FileSystem.readAsStringAsync(filePath);
  const lines = content.trim().split('\n');
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  const dateCols: number[] = [];
  const debitCols: number[] = [];
  const creditCols: number[] = [];
  const amountCols: number[] = [];
  let descCol: number | null = null;

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (h.includes('date') || h.includes('time') || h.includes('datetime') ||
      h.includes('transaction date') || h.includes('value date') ||
      h.includes('posting date') || h.includes('booking date') ||
      h.includes('datum') || h.includes('fecha') || h.includes('दिनांक')) {
      dateCols.push(i);
    } else if (h.includes('debit') || h.includes('withdrawal') || h.includes('dr') ||
      h.includes('money out') || h.includes('amount debited') ||
      h.includes('ausgaben') || h.includes('débito') || h.includes('spent')) {
      debitCols.push(i);
    } else if (h.includes('credit') || h.includes('deposit') || h.includes('cr') ||
      h.includes('money in') || h.includes('amount credited') ||
      h.includes('einnahmen') || h.includes('crédito') || h.includes('received')) {
      creditCols.push(i);
    } else if (h.includes('amount') || h.includes('sum') || h.includes('total') ||
      h.includes('value') || h.includes('betrag') || h.includes('montant')) {
      amountCols.push(i);
    } else if (h.includes('description') || h.includes('narration') ||
      h.includes('details') || h.includes('particulars') || h.includes('reference') ||
      h.includes('merchant') || h.includes('memo') || h.includes('verwendungszweck')) {
      descCol = i;
    }
  }

  let debitIndex: number | null = null;
  let creditIndex: number | null = null;
  let amountIndex: number | null = null;

  if (debitCols.length > 0 && creditCols.length > 0) {
    debitIndex = debitCols[0];
    creditIndex = creditCols[0];
  } else if (amountCols.length > 0) {
    amountIndex = amountCols[0];
  }

  const existingTransactions = await getAllTransactions(2000, 0);
  const importedTransactions: Transaction[] = [];
  const affectedDates = new Set<string>();

  for (let idx = 1; idx < lines.length; idx++) {
    const line = lines[idx];
    if (!line.trim()) continue;

    const fields = line.split(',').map((f) => f.trim());

    let amountMinor: number | null = null;
    let type: 'credit' | 'debit' = 'debit';
    let dateStr: string | null = null;

    if (debitIndex !== null && debitIndex < fields.length) {
      amountMinor = parseAmount(fields[debitIndex], 'en');
      if (amountMinor !== null && amountMinor > 0) {
        type = 'debit';
        dateStr = extractDate(dateCols, fields);
      }
    }
    
    if ((amountMinor === null || amountMinor === 0) && creditIndex !== null && creditIndex < fields.length) {
      amountMinor = parseAmount(fields[creditIndex], 'en');
      if (amountMinor !== null && amountMinor > 0) {
        type = 'credit';
        dateStr = extractDate(dateCols, fields);
      }
    }
    
    if (amountMinor === null && amountIndex !== null && amountIndex < fields.length) {
      const parsedVal = parseAmount(fields[amountIndex], 'en');
      if (parsedVal !== null) {
        amountMinor = Math.abs(parsedVal);
        type = parsedVal >= 0 ? 'credit' : 'debit';
        dateStr = extractDate(dateCols, fields);
      }
    }

    let desc = '';
    if (descCol !== null && descCol < fields.length) {
      desc = fields[descCol];
    }

    if (amountMinor === null || !dateStr) continue;

    // Detect currency from description or fields, fallback to USD
    const currencyDetection = detectCurrency(desc) || detectCurrency(line) || { code: 'USD', symbol: '$', locale: 'en' };

    const parsed: ParsedTransaction = {
      raw_text: line,
      amount_minor: amountMinor,
      currency_code: currencyDetection.code,
      type: type,
      confidence: 'high'
    };

    // Deduplication check
    if (isDuplicate(parsed, existingTransactions) || isDuplicate(parsed, importedTransactions)) {
      continue;
    }

    const txDate = new Date(dateStr).toISOString();

    const tx: Transaction = {
      id: generateTransactionId(),
      amount_minor: amountMinor,
      currency_code: currencyDetection.code,
      currency_symbol: currencyDetection.symbol,
      type: type,
      source: 'import',
      description: desc,
      merchant: extractMerchantSimple(desc),
      category: 'Other',
      date: txDate,
      raw_text: line,
      capture_method: 'import',
      language_detected: 'en',
      is_verified: true,
      created_at: new Date().toISOString()
    };

    await insertTransaction(tx);
    importedTransactions.push(tx);
    affectedDates.add(txDate.split('T')[0]);
  }

  for (const date of affectedDates) {
    await invalidateDailySummaryCache(date);
  }

  return importedTransactions;
}

function extractDate(dateCols: number[], fields: string[]): string | null {
  if (dateCols.length === 0) return new Date().toISOString().split('T')[0];
  for (const col of dateCols) {
    if (col < fields.length && fields[col]) {
      return formatDateString(fields[col]);
    }
  }
  return new Date().toISOString().split('T')[0];
}

function formatDateString(dateStr: string): string | null {
  const cleanStr = dateStr.replace(/[-\/\s\.]+/g, '-');
  const parts = cleanStr.split('-');
  
  if (parts.length === 3) {
    // Check if YYYY-MM-DD
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    // Check if DD-MM-YYYY or MM-DD-YYYY - assume DD-MM-YYYY for global standards
    if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return dateStr;
}

// ============================================================================
// OFX / QFX Importer
// ============================================================================

export async function importOFX(filePath: string): Promise<Transaction[]> {
  const content = await FileSystem.readAsStringAsync(filePath);
  let transactions: Transaction[] = [];

  try {
    transactions = parseOFXML(content);
  } catch {
    transactions = parseOFXSGML(content);
  }

  const existingTransactions = await getAllTransactions(2000, 0);
  const insertedTransactions: Transaction[] = [];
  const affectedDates = new Set<string>();

  for (const tx of transactions) {
    const parsed: ParsedTransaction = {
      raw_text: tx.raw_text,
      amount_minor: tx.amount_minor,
      currency_code: tx.currency_code,
      type: tx.type,
      confidence: 'high'
    };

    if (isDuplicate(parsed, existingTransactions) || isDuplicate(parsed, insertedTransactions)) {
      continue;
    }

    await insertTransaction(tx);
    insertedTransactions.push(tx);
    affectedDates.add(tx.date.split('T')[0]);
  }

  for (const date of affectedDates) {
    await invalidateDailySummaryCache(date);
  }

  return insertedTransactions;
}

function parseOFXML(content: string): Transaction[] {
  const transactions: Transaction[] = [];
  const ofxRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let match: RegExpExecArray | null;

  while ((match = ofxRegex.exec(content)) !== null) {
    const block = match[1];

    const typeEl = block.match(/<(TRNTYPE)>([^<]*)/i);
    const dateEl = block.match(/<(DTPOSTED)>([^<]*)/i);
    const amtEl = block.match(/<(TRNAMT)>([^<]*)/i);
    const nameEl = block.match(/<(NAME)>([^<]*)/i);
    const memoEl = block.match(/<(MEMO)>([^<]*)/i);
    const curDefEl = block.match(/<(CURDEF)>([^<]*)/i);
    const curSymEl = block.match(/<(CURSYM)>([^<]*)/i);

    if (!typeEl || !dateEl || !amtEl) continue;

    const rawAmt = parseFloat(amtEl[2].trim());
    const amountMinor = Math.round(Math.abs(rawAmt) * 100);
    const trnType = typeEl[2].trim().toUpperCase();
    
    let type: 'credit' | 'debit' = 'debit';
    if (trnType.includes('CREDIT') || trnType === 'C' || trnType === 'DEP') {
      type = 'credit';
    } else if (trnType.includes('DEBIT') || trnType === 'D' || trnType === 'WD') {
      type = 'debit';
    } else {
      type = rawAmt >= 0 ? 'credit' : 'debit';
    }

    const merchant = nameEl ? nameEl[2].trim() : 'OFX Merchant';
    const desc = memoEl ? memoEl[2].trim() : merchant;
    const currency = (curDefEl ? curDefEl[2].trim() : (curSymEl ? curSymEl[2].trim() : 'USD')).substring(0, 3);
    const dateStr = dateEl[2].trim().substring(0, 8); // YYYYMMDD

    const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}T12:00:00.000Z`;

    transactions.push({
      id: generateTransactionId(),
      amount_minor: amountMinor,
      currency_code: currency,
      currency_symbol: getCurrencySymbol(currency),
      type,
      source: 'import',
      description: desc,
      merchant,
      category: 'Other',
      date: formattedDate,
      raw_text: block,
      capture_method: 'import',
      language_detected: 'en',
      is_verified: true,
      created_at: new Date().toISOString()
    });
  }

  return transactions;
}

function parseOFXSGML(content: string): Transaction[] {
  const transactions: Transaction[] = [];
  const cleanedContent = content.replace(/^[\s\S]*?<OFX>/i, '');
  const sgmlRegex = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/STMTTR|$)*/gi;
  let match: RegExpExecArray | null;

  while ((match = sgmlRegex.exec(cleanedContent)) !== null) {
    const block = match[1];
    if (!block.trim()) continue;

    const typeEl = block.match(/<TRNTYPE>([^<\r\n]*)/i);
    const dateEl = block.match(/<DTPOSTED>([^<\r\n]*)/i);
    const amtEl = block.match(/<TRNAMT>([^<\r\n]*)/i);
    const nameEl = block.match(/<NAME>([^<\r\n]*)/i);
    const memoEl = block.match(/<MEMO>([^<\r\n]*)/i);

    if (!typeEl || !dateEl || !amtEl) continue;

    const rawAmt = parseFloat(amtEl[1].trim());
    const amountMinor = Math.round(Math.abs(rawAmt) * 100);
    const trnType = typeEl[1].trim().toUpperCase();

    let type: 'credit' | 'debit' = 'debit';
    if (trnType.includes('CREDIT') || trnType === 'C' || trnType === 'DEP') {
      type = 'credit';
    } else if (trnType.includes('DEBIT') || trnType === 'D' || trnType === 'WD') {
      type = 'debit';
    } else {
      type = rawAmt >= 0 ? 'credit' : 'debit';
    }

    const merchant = nameEl ? nameEl[1].trim() : 'SGML Merchant';
    const desc = memoEl ? memoEl[1].trim() : merchant;
    const dateStr = dateEl[1].trim().substring(0, 8); // YYYYMMDD

    const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}T12:00:00.000Z`;

    transactions.push({
      id: generateTransactionId(),
      amount_minor: amountMinor,
      currency_code: 'USD',
      currency_symbol: '$',
      type,
      source: 'import',
      description: desc,
      merchant,
      category: 'Other',
      date: formattedDate,
      raw_text: block,
      capture_method: 'import',
      language_detected: 'en',
      is_verified: true,
      created_at: new Date().toISOString()
    });
  }

  return transactions;
}

// ============================================================================
// PDF Importer
// ============================================================================

export async function importPDF(filePath: string): Promise<Transaction[]> {
  let text = '';
  try {
    // Read PDF file as string. In some cases, text content can be partially 
    // parsed directly as a string or regexed.
    text = await FileSystem.readAsStringAsync(filePath, { encoding: FileSystem.EncodingType.UTF8 });
  } catch (error) {
    console.error('Failed to read PDF as string:', error);
    return [];
  }

  if (!text) return [];

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const existingTransactions = await getAllTransactions(2000, 0);
  const importedTransactions: Transaction[] = [];
  const affectedDates = new Set<string>();

  for (const line of lines) {
    const cleanLine = line.trim();
    if (cleanLine.length < 15) continue;

    // Use parseSMS logic to extract transactions from PDF lines
    const parsed = parseSMS(cleanLine);
    if (!parsed) continue;

    // Check duplicate
    if (isDuplicate(parsed, existingTransactions) || isDuplicate(parsed, importedTransactions)) {
      continue;
    }

    let tx: Transaction;
    if (parsed.confidence === 'high') {
      const txDate = new Date().toISOString();
      tx = {
        id: generateTransactionId(),
        amount_minor: parsed.amount_minor || 0,
        currency_code: parsed.currency_code || 'USD',
        currency_symbol: getCurrencySymbol(parsed.currency_code || 'USD'),
        type: parsed.type || 'debit',
        source: 'import',
        description: cleanLine,
        merchant: extractMerchantSimple(cleanLine),
        category: 'Other',
        date: txDate,
        raw_text: cleanLine,
        capture_method: 'import',
        language_detected: 'en',
        is_verified: true,
        created_at: new Date().toISOString()
      };
    } else {
      // Enhance via AI if low confidence
      tx = await enhanceTransaction(parsed);
      tx.capture_method = 'import';
    }

    await insertTransaction(tx);
    importedTransactions.push(tx);
    affectedDates.add(tx.date.split('T')[0]);
  }

  for (const date of affectedDates) {
    await invalidateDailySummaryCache(date);
  }

  return importedTransactions;
}
