import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
});

// Demo pricing helper — a fixed WETH price so USD ↔ WETH is consistent across the app.
export const WETH_USD = 3412;

// Lazy fee accrual: given a position, add fees earned since it was last touched.
// Demo model: fees_per_year_usd = valueUsd * apr/100 ; convert to WETH by /WETH_USD.
export function accrue(pos: { valueUsd: number; feesWeth: number; updatedAt: Date }, poolApr: number, now = new Date()) {
  const secs = Math.max(0, (now.getTime() - pos.updatedAt.getTime()) / 1000);
  const perYearUsd = pos.valueUsd * (poolApr / 100);
  const earnedUsd = (perYearUsd * secs) / (365 * 24 * 3600);
  const earnedWeth = earnedUsd / WETH_USD;
  return pos.feesWeth + earnedWeth;
}
