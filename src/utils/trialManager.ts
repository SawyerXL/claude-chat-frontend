// Trial Manager - Manages 7-day trial with daily message limit

const TRIAL_DAILY_LIMIT = 5;
const TRIAL_DAYS = 7;

interface TrialState {
  isTrial: boolean;
  startDate: string | null;
  dailyCount: number;
  lastResetDate: string | null;
}

const STORAGE_KEY = 'claude_trial_state';

// Get today's date string (YYYY-MM-DD)
function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

// Load trial state from localStorage
export function loadTrialState(): TrialState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const state = JSON.parse(stored) as TrialState;
      // Check if we need to reset daily count
      const today = getTodayString();
      if (state.lastResetDate !== today) {
        state.dailyCount = 0;
        state.lastResetDate = today;
        saveTrialState(state);
      }
      return state;
    }
  } catch (e) {
    console.error('Error loading trial state:', e);
  }
  return {
    isTrial: false,
    startDate: null,
    dailyCount: 0,
    lastResetDate: getTodayString(),
  };
}

// Save trial state to localStorage
export function saveTrialState(state: TrialState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error saving trial state:', e);
  }
}

// Start trial (called when user redeems trial code)
export function startTrial(): void {
  const state: TrialState = {
    isTrial: true,
    startDate: new Date().toISOString(),
    dailyCount: 0,
    lastResetDate: getTodayString(),
  };
  saveTrialState(state);
}

// Check if trial is still valid
export function isTrialValid(): boolean {
  const state = loadTrialState();
  if (!state.isTrial || !state.startDate) return false;

  const startDate = new Date(state.startDate);
  const now = new Date();
  const daysPassed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  return daysPassed < TRIAL_DAYS;
}

// Get remaining trial days
export function getRemainingTrialDays(): number {
  const state = loadTrialState();
  if (!state.isTrial || !state.startDate) return 0;

  const startDate = new Date(state.startDate);
  const now = new Date();
  const daysPassed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  return Math.max(0, TRIAL_DAYS - daysPassed);
}

// Get remaining messages for today
export function getRemainingMessages(): number {
  const state = loadTrialState();
  return Math.max(0, TRIAL_DAILY_LIMIT - state.dailyCount);
}

// Check if user can send message
export function canSendMessage(): { canSend: boolean; reason?: string } {
  const state = loadTrialState();

  // Not a trial user
  if (!state.isTrial) {
    return { canSend: true };
  }

  // Trial expired
  if (!isTrialValid()) {
    return { canSend: false, reason: '体验期已结束，请续费' };
  }

  // Daily limit reached
  if (state.dailyCount >= TRIAL_DAILY_LIMIT) {
    return { canSend: false, reason: `今日对话次数已用完 (${TRIAL_DAILY_LIMIT}/${TRIAL_DAILY_LIMIT})` };
  }

  return { canSend: true };
}

// Record a message sent
export function recordMessageSent(): void {
  const state = loadTrialState();
  state.dailyCount++;
  state.lastResetDate = getTodayString();
  saveTrialState(state);
}

// Get trial info for display
export function getTrialInfo(): {
  isTrial: boolean;
  remainingDays: number;
  remainingMessages: number;
  totalDailyLimit: number;
} {
  const state = loadTrialState();
  return {
    isTrial: state.isTrial,
    remainingDays: getRemainingTrialDays(),
    remainingMessages: getRemainingMessages(),
    totalDailyLimit: TRIAL_DAILY_LIMIT,
  };
}

// Clear trial state (when trial ends or user subscribes)
export function clearTrial(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Check if user has active subscription (non-trial)
export async function hasActiveSubscription(): Promise<boolean> {
  try {
    const token = localStorage.getItem('claude_auth_token') || localStorage.getItem('claude_token');
    if (!token) return false;

    // Check if user has non-trial subscription via API
    const res = await fetch('/api/v1/user/subscription', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      return data.active === true;
    }
  } catch (e) {
    console.error('Error checking subscription:', e);
  }

  // Fallback: check if trial is valid
  return isTrialValid();
}
