import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string, length: number = 4): string {
  if (!address) return '';
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function formatDateUTC(date: number): string {
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  };

  return new Date(date * 1000).toLocaleString('en-US', options);
}

export function formatTinybarsToHbar(tinybars: number | string, fractionDigits = 6) {
  const hbar = Number(tinybars) / 100000000;
  return hbar.toFixed(fractionDigits);
}

export function getRemainingDaysBetweenTimestamps(startTimestamp: number, endTimestamp: number) {
  const startMs = Number(startTimestamp) * 1000;
  const endMs = Number(endTimestamp) * 1000;
  const diffMs = endMs - startMs;

  const msInDay = 1000 * 60 * 60 * 24;
  return Math.ceil(diffMs / msInDay);
}

export function getRemainingDaysFromNow(targetTimestamp: number) {
  const nowMs = Date.now();
  const targetMs = Number(targetTimestamp) * 1000;
  const diffMs = targetMs - nowMs;

  const msInDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.ceil(diffMs / msInDay));
}
