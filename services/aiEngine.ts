import * as NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';
import type { NotificationSummary, Transaction } from '../types';
import { initLlama, LlamaContext } from 'llama.rn';
import { saveUserProfile } from '../db/database';
import { formatAmount } from '../utils/mathUtils';

// ============================================================================
// Type Exports (for TypeScript compatibility)
// ============================================================================

export interface ParsedTransaction {
  raw_text: string;
  amount_minor: number | null;
  currency_code: string | null;
  type: 'credit' | 'debit' | null;
  confidence: 'high' | 'low';
  merchant?: string;
}

export type TransactionCategory = 'Food' | 'Transport' | 'Shopping' | 'Entertainment' | 'Health' | 'Utilities' | 'Transfer' | 'Salary' | 'Refund' | 'Other';

// ============================================================================
// Constants
// ============================================================================

export const MODEL_ID = "llama.rn-qwen2.5-0.5b-instruct";
export const MODEL_DOWNLOAD_URL = 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf';
export const MODEL_FILENAME = 'qwen2.5-0.5b-instruct-q4_k_m.gguf';
export const MODEL_LOCAL_PATH = `${FileSystem.documentDirectory}.expensiu/models/${MODEL_FILENAME}`;

const AI_TIMEOUT_MS = 10000;

// ============================================================================
// Global: Llama context (singleton)
// ============================================================================

let llamaContext: LlamaContext | null = null;

export async function isModelDownloaded(): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(MODEL_LOCAL_PATH);
    return fileInfo.exists && (fileInfo as any).size > 0;
  } catch {
    return false;
  }
}

export function isModelLoaded(): boolean {
  return llamaContext !== null;
}

export async function downloadModel(
  onProgress: (percent: number) => void
): Promise<void> {
  const state = await NetInfo.fetch();
  if (state.type !== 'wifi') {
    throw new Error("Please connect to WiFi to download the AI model (one-time, ~300MB)");
  }

  // Create directory if it doesn't exist
  const dirInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory + '.expensiu/models');
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory + '.expensiu/models', { intermediates: true });
  }

  const downloadResumable = FileSystem.createDownloadResumable(
    MODEL_DOWNLOAD_URL,
    MODEL_LOCAL_PATH,
    {},
    (downloadProgress) => {
      const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
      onProgress(progress * 100);
    }
  );

  try {
    const result = await downloadResumable.downloadAsync();
    if (!result || !result.uri) {
      throw new Error("Download failed - no file saved");
    }

    const fileInfo = await FileSystem.getInfoAsync(MODEL_LOCAL_PATH);
    if (!fileInfo.exists || (fileInfo as any).size < 10000000) {
      throw new Error("Downloaded model file is incomplete or corrupted");
    }

    await saveUserProfile({
      ai_model_downloaded: true,
      ai_model_version: "qwen2.5-0.5b-instruct-q4_k_m",
    });
  } catch (e) {
    console.error("Error downloading model:", e);
    throw e;
  }
}

// ============================================================================
// Helper: Get system locale for AI context
// ============================================================================

function getSystemLocale(): string {
  try {
    const { Language } = require('expo-device');
    return Language ?? 'en-US';
  } catch {
    return 'en-US';
  }
}

// ============================================================================
// AI Initialization
// ============================================================================

export async function initAI(): Promise<void> {
  try {
    const isDownloaded = await isModelDownloaded();

    if (!isDownloaded) {
      throw new Error('Please connect to WiFi to download the AI model (one-time, ~300MB).');
    }

    // Initialize llama.rn with MODEL_LOCAL_PATH directly
    llamaContext = await initLlama({ model: MODEL_LOCAL_PATH, use_mlock: true, n_ctx: 2048 });

    console.log('AI model initialized and ready');
  } catch (error: any) {
    console.error('Failed to initialize AI:', error.message);
    throw new Error(error?.message || 'AI model not available');
  }
}

// ============================================================================
// Enhance Transaction with AI
// ============================================================================

export async function enhanceTransaction(
  partial: ParsedTransaction
): Promise<Transaction> {
  // Build system prompt (exact as specified)
  const systemPrompt = `You are a financial transaction parser.
Extract transaction details from the text below.
Respond ONLY with a valid JSON object. No explanation.
No markdown. No extra text. Just the JSON.

Required JSON format:
{
  "amount_minor": <integer in minor currency units or null>,
  "currency_code": <ISO 4217 string or null>,
  "type": <"credit" or "debit" or null>,
  "merchant": <string or null>,
  "category": <one of: Food, Transport, Shopping,
    Entertainment, Health, Utilities, Transfer,
    Salary, Refund, Other>,
  "language_detected": <ISO 639-1 code>
}`;

  const userMessage = partial.raw_text || 'Extract transaction details';

  try {
    let result: any;
    if (!llamaContext) {
      throw new Error('AI not initialized');
    }

    // Add a race timeout to respect the 10-second requirement
    const aiPromise = llamaContext.completion({
      prompt: `${systemPrompt}\n\nTransaction text: "${userMessage}"`,
      n_predict: 128,
      temperature: 0.1,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI timeout')), AI_TIMEOUT_MS)
    );

    result = await Promise.race([aiPromise, timeoutPromise]);

    const match = result?.text?.match(/\{[\s\S]*\}/);

    if (!match) {
      console.log('No JSON in AI response, using defaults');
      return createDefaultTransaction(partial);
    }

    try {
      const parsed = JSON.parse(match[0]);

      return {
        id: generateTransactionId(),
        amount_minor: parsed.amount_minor ?? partial.amount_minor ?? 0,
        currency_code: parsed.currency_code ?? partial.currency_code ?? 'USD',
        currency_symbol: getCurrencySymbol(parsed.currency_code ?? partial.currency_code ?? 'USD'),
        type: parsed.type ?? partial.type ?? 'debit',
        source: 'ai-enhanced',
        description: partial.raw_text || '',
        merchant: parsed.merchant || partial.merchant || '',
        category: parsed.category || 'Other',
        date: new Date().toISOString(),
        raw_text: partial.raw_text || '',
        capture_method: 'sms',
        language_detected: parsed.language_detected || getSystemLocale(),
        is_verified: false,
        created_at: new Date().toISOString(),
      };
    } catch (parseError) {
      console.error('JSON parse failed:', parseError);
      return createDefaultTransaction(partial);
    }

  } catch (error) {
    console.error('AI call failed, using defaults:', error);
    return createDefaultTransaction(partial);
  }
}

function createDefaultTransaction(
  partial: ParsedTransaction
): Transaction {
  const isCredit = partial.type === 'credit';

  return {
    id: generateTransactionId(),
    amount_minor: partial.amount_minor || 0,
    currency_code: partial.currency_code || 'USD',
    currency_symbol: getCurrencySymbol(partial.currency_code || 'USD'),
    type: isCredit ? 'credit' : 'debit',
    source: 'ai-fallback',
    description: '',
    merchant: partial.merchant || '',
    category: 'Other',
    date: new Date().toISOString(),
    raw_text: partial.raw_text || '',
    capture_method: 'sms',
    language_detected: getSystemLocale(),
    is_verified: false,
    created_at: new Date().toISOString(),
  };
}

function getCurrencySymbol(currencyCode: string): string {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥',
    CNY: '¥', KRW: '₩', SAR: '﷼', AED: 'د.إ', BRL: 'R$',
  };

  return symbols[currencyCode.toUpperCase()] || '$';
}

function generateTransactionId(): string {
  const random = Math.random().toString(36).substring(2);
  return `txn_${Date.now()}_${random.slice(0, 9)}`;
}

// ============================================================================
// Classify Transaction Category
// ============================================================================

export async function classifyCategory(
  description: string,
  merchant: string
): Promise<TransactionCategory> {
  const combinedText = `${description} ${merchant}`.trim().toLowerCase();

  try {
    if (!llamaContext) {
      throw new Error('AI not initialized');
    }

    const aiPromise = llamaContext.completion({
      prompt: `Classify this transaction into one of these categories: Food, Transport, Shopping, Entertainment, Health, Utilities, Transfer, Salary, Refund, Other.\n\nText: ${combinedText}\n\nRespond with ONLY the category name.`,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI timeout')), AI_TIMEOUT_MS)
    );

    const result: any = await Promise.race([aiPromise, timeoutPromise]);

    const match = result?.text?.match(/([A-Za-z]+)/);
    if (match && match[1]) {
      const cat = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      const categories = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Utilities', 'Transfer', 'Salary', 'Refund', 'Other'];
      if (categories.includes(cat)) {
        return cat as TransactionCategory;
      }
    }
  } catch (error) {
    console.log('Category classification fallback:', error);
  }

  return 'Other';
}

// ============================================================================
// Generate Summary Message
// ============================================================================

export async function generateSummaryMessage(
  summary: NotificationSummary,
  userName: string
): Promise<string> {
  const tone = summary.tone;
  const netMajor = summary.net_balance_minor / 100;

  let context = '';
  if (tone === 'winning') {
    context = `Balance is healthy and positive (${netMajor > 0 ? '+' : ''}${netMajor.toFixed(0)})`;
  } else if (tone === 'heads_up') {
    context = `Balanced spending, staying within budget`;
  } else if (tone === 'warning') {
    context = `Approaching budget limits, monitor spending`;
  } else if (tone === 'critical') {
    context = `Budget significantly exceeded, review recent expenses`;
  }

  try {
    if (!llamaContext) {
      throw new Error('AI not initialized');
    }

    const aiPromise = llamaContext.completion({
      prompt: `Write a SHORT friendly notification message (${summary.period} period, tone: ${tone}).\n\nContext: ${context}\nUser name: ${userName}\nConstraints: Maximum 12 words. Personal and warm. Don't mention amounts.`,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI timeout')), AI_TIMEOUT_MS)
    );

    const result: any = await Promise.race([aiPromise, timeoutPromise]);
    const message = result?.text || '';
    return truncateToWordLimit(message.trim(), 12) || generateFallbackMessage(summary.tone, userName);

  } catch (error) {
    console.error('Summary message generation failed:', error);
    return generateFallbackMessage(summary.tone, userName);
  }
}

function truncateToWordLimit(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
}

function generateFallbackMessage(tone: string, userName: string): string {
  const messages: Record<string, string[]> = {
    winning: [`Great job ${userName}!`, `${userName}, doing great!`, `Keep it up ${userName}!`],
    heads_up: [`Thanks for checking in ${userName}`, `Staying mindful ${userName}`],
    warning: [`Hey ${userName}, keep an eye on spending`, `${userName}, let's review recent purchases`],
    critical: [`${userName}, your budget needs attention now`, `Alert ${userName}, check recent transactions ASAP`],
  };

  const options = messages[tone] || messages.heads_up;
  return options[Math.floor(Math.random() * options.length)];
}

export async function generateDetailedSummary(
  period: 'weekly' | 'monthly',
  profile: any,
  transactions: Transaction[]
): Promise<string> {
  try {
    if (!llamaContext) {
      throw new Error('AI not initialized');
    }

    const userName = profile?.name || 'User';
    const currencyCode = profile?.currency_code || 'USD';
    const locale = profile?.locale || 'en';

    const credits = transactions.filter(t => t.type === 'credit');
    const debits = transactions.filter(t => t.type === 'debit');

    const totalCredits = credits.reduce((acc, t) => acc + t.amount_minor, 0);
    const totalDebits = debits.reduce((acc, t) => acc + t.amount_minor, 0);
    const netBalance = totalCredits - totalDebits;

    const formattedCredits = formatAmount(totalCredits, currencyCode, locale);
    const formattedDebits = formatAmount(totalDebits, currencyCode, locale);
    const formattedNet = formatAmount(netBalance, currencyCode, locale);

    // Group transactions by category to list top expenses
    const categoryTotals: Record<string, number> = {};
    for (const tx of debits) {
      categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount_minor;
    }

    const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    const topCategoriesText = sortedCategories.slice(0, 3).map(([cat, amt]) => {
      return `- ${cat}: ${formatAmount(amt, currencyCode, locale)}`;
    }).join('\n');

    const recentTxText = transactions.slice(0, 8).map(tx => {
      const typeSign = tx.type === 'credit' ? '+' : '-';
      return `- ${tx.merchant || 'Unknown'}: ${typeSign}${formatAmount(tx.amount_minor, currencyCode, locale)} (${tx.category})`;
    }).join('\n');

    const prompt = `<|im_start|>system
You are a personal finance assistant. Keep your response friendly, concise, and helpful. Use a warm tone.
Your task is to write a short financial summary (3-4 sentences maximum) based on the user's weekly or monthly transaction summary provided below.
Identify their main spending areas, positive behaviors (if any), and offer one clear, specific tip to save money next time.
Do not use markdown headers, bold titles, or placeholders like [Name]. Just write a simple paragraph.<|im_end|>
<|im_start|>user
Here is the financial summary for ${userName} for this ${period}:
- Total Income: ${formattedCredits}
- Total Expenses: ${formattedDebits}
- Net Balance: ${formattedNet}

Top expense categories:
${topCategoriesText || 'None'}

Recent transactions:
${recentTxText || 'No recent transactions'}

Write a friendly 3-4 sentence paragraph summary and a single actionable saving tip.<|im_end|>
<|im_start|>assistant
`;

    const aiPromise = llamaContext.completion({
      prompt: prompt,
      n_predict: 256,
      temperature: 0.7,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI timeout')), 25000)
    );

    const result: any = await Promise.race([aiPromise, timeoutPromise]);
    let text = result?.text || '';
    
    text = text.replace(/<\|im_end\|>/g, '').trim();
    if (!text) {
      throw new Error('Empty response from AI');
    }
    return text;
  } catch (error) {
    console.error('Detailed summary generation failed:', error);
    return generateFallbackDetailedSummary(period, profile, transactions);
  }
}

function generateFallbackDetailedSummary(
  period: 'weekly' | 'monthly',
  profile: any,
  transactions: Transaction[]
): string {
  const userName = profile?.name || 'User';
  const currencyCode = profile?.currency_code || 'USD';
  const locale = profile?.locale || 'en';

  const credits = transactions.filter(t => t.type === 'credit');
  const debits = transactions.filter(t => t.type === 'debit');

  const totalCredits = credits.reduce((acc, t) => acc + t.amount_minor, 0);
  const totalDebits = debits.reduce((acc, t) => acc + t.amount_minor, 0);

  const formattedCredits = formatAmount(totalCredits, currencyCode, locale);
  const formattedDebits = formatAmount(totalDebits, currencyCode, locale);

  const debitCategories: Record<string, number> = {};
  for (const t of debits) {
    debitCategories[t.category] = (debitCategories[t.category] || 0) + t.amount_minor;
  }
  const topCat = Object.entries(debitCategories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Other';

  if (totalDebits === 0) {
    return `Hello ${userName}! During this ${period}, you had no recorded expenses. Great job keeping your wallet closed and saving your hard-earned money!`;
  }

  return `Hey ${userName}, here is your ${period} financial breakdown. You spent a total of ${formattedDebits} while bringing in ${formattedCredits}. Your primary spending area was ${topCat}. To boost your savings next time, try setting a budget cap on ${topCat} and reviewing any subscriptions you might not need!`;
}
