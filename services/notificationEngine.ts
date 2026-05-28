import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import type { NotificationSummary } from '../types';
import { getDailySummary, getWeeklySummary, getMonthlySummary, getUserProfile } from '../db/database';
import { isModelLoaded, generateSummaryMessage } from './aiEngine';

// ============================================================================
// Notification Tone Determination (Pure Math)
// ============================================================================

export function determineTone(
  summary: NotificationSummary,
  monthlyBudgetMinor: number
): 'winning' | 'heads_up' | 'warning' | 'critical' {
  const budget = monthlyBudgetMinor / (summary.period === 'weekly' ? 4 : summary.period === 'monthly' ? 1 : 30);
  const ratio = summary.total_debit_minor / (budget || 1);

  if (ratio < 0.5) return 'winning';
  if (ratio < 0.75) return 'heads_up';
  if (ratio < 1.0) return 'warning';
  return 'critical';
}

// ============================================================================
// Notification Payload Building
// ============================================================================

export async function buildNotification(
  summary: NotificationSummary,
  userName: string
): Promise<{ title: string; body: string }> {
  // Fetch budget from profile
  const profile = await getUserProfile();
  const monthlyBudgetMinor = profile?.monthly_budget_minor || 100000;
  const tone = determineTone(summary, monthlyBudgetMinor);

  const fallbackBodies: Record<string, string> = {
    winning: 'Great progress this week. Tap to see your breakdown.',
    heads_up: 'Spending at a decent pace. Check where it is going.',
    warning: 'You are on a spending spree mate. Tap to review.',
    critical: 'You have crossed your budget. Time to check in.',
  };

  let body = '';

  try {
    if (isModelLoaded()) {
      body = await generateSummaryMessage({ ...summary, tone }, userName);
    } else {
      body = fallbackBodies[tone];
    }
  } catch (e) {
    body = fallbackBodies[tone];
  }

  const titles: Record<string, string> = {
    winning: `Hey ${userName}, you are winning 🎯`,
    heads_up: `Hey ${userName}, heads up 👀`,
    warning: `Hey ${userName}, easy on the wallet 💸`,
    critical: `Hey ${userName}, wallet is crying 🚨`,
  };

  return { title: titles[tone] || `Hey ${userName}, check-in`, body };
}

// ============================================================================
// Notification Schedulers
// ============================================================================

export async function scheduleWeeklyNotification(): Promise<void> {
  const profile = await getUserProfile();
  const userName = profile?.name || 'User';
  const weeklySummary = await getWeeklySummary();
  const content = await buildNotification(weeklySummary, userName);

  // Clear existing weekly notifications to avoid duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Weekly Trigger (Every Sunday at 8:00 PM local time)
  // Expo notifications uses 1 = Sunday, 2 = Monday, etc.
  await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      data: { screen: 'summary', period: 'weekly' },
    },
    trigger: {
      weekday: 1, 
      hour: 20,
      minute: 0,
      repeats: true,
    },
  });
}

export async function scheduleDailyNotification(): Promise<void> {
  const todayStr = new Date().toISOString().split('T')[0];
  const dailySummary = await getDailySummary(todayStr);

  // Only send if transaction count is >= 3 that day
  if (dailySummary.transaction_count < 3) return;

  const profile = await getUserProfile();
  const userName = profile?.name || 'User';
  const content = await buildNotification(dailySummary, userName);

  // Daily Trigger (Every day at 7:00 PM local time)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      data: { screen: 'summary', period: 'daily' },
    },
    trigger: {
      hour: 19,
      minute: 0,
      repeats: true,
    },
  });
}

export async function scheduleMonthlyNotification(): Promise<void> {
  const monthlySummary = await getMonthlySummary();
  const profile = await getUserProfile();
  const userName = profile?.name || 'User';
  const content = await buildNotification(monthlySummary, userName);

  // Monthly Trigger (1st of every month at 9:00 AM)
  await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      data: { screen: 'summary', period: 'monthly' },
    },
    trigger: {
      day: 1,
      hour: 9,
      minute: 0,
      repeats: true,
    },
  });
}

// ============================================================================
// Notification Handlers
// ============================================================================

export function handleNotificationTap(response: Notifications.NotificationResponse): void {
  const data = response.notification.request.content.data;
  if (data && data.screen === 'summary') {
    const period = data.period || 'weekly';
    router.push(`/summary?period=${period}`);
  }
}

export async function rescheduleAllOnBoot(): Promise<void> {
  try {
    await scheduleDailyNotification();
    await scheduleWeeklyNotification();
    await scheduleMonthlyNotification();
  } catch (error) {
    console.error('Failed to reschedule notifications on boot:', error);
  }
}
