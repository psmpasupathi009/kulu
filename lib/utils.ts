import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ==================== ROSCA Financial Calculations ====================

export type InterestMethod = "SIMPLE" | "DECLINING";

/**
 * Calculate interest for a given week using declining balance method
 * @param remainingBalance - Current remaining principal
 * @param interestRate - Weekly interest rate (e.g., 1.0 for 1%)
 * @returns Interest amount for this week (always 0 - no interest)
 */
export function calculateWeeklyInterest(
  remainingBalance: number,
  interestRate: number = 0.0
): number {
  return 0; // No interest
}

/**
 * Calculate weekly payment for declining balance method
 * @param remainingBalance - Current remaining principal
 * @param principalPayment - Principal payment amount (usually ₹100)
 * @param interestRate - Weekly interest rate (default 0% - no interest)
 * @returns Total payment (principal only, no interest)
 */
export function calculateWeeklyPayment(
  remainingBalance: number,
  principalPayment: number = 100,
  interestRate: number = 0.0
): { principal: number; interest: number; total: number; newBalance: number } {
  const interest = 0; // No interest
  const total = principalPayment; // Only principal
  const newBalance = Math.max(0, remainingBalance - principalPayment);

  return {
    principal: principalPayment,
    interest,
    total,
    newBalance,
  };
}

/**
 * Calculate total interest for declining balance method over 10 weeks
 * @param principal - Original loan amount
 * @param weeklyPrincipalPayment - Principal payment per week (default ₹100)
 * @param interestRate - Weekly interest rate (default 0% - no interest)
 * @param weeks - Number of weeks (default 10)
 * @returns Total interest paid (always 0 - no interest)
 */
export function calculateTotalInterestDeclining(
  principal: number,
  weeklyPrincipalPayment: number = 100,
  interestRate: number = 0.0,
  weeks: number = 10
): number {
  return 0; // No interest
}

/**
 * Calculate total interest for simple interest method
 * @param principal - Original loan amount
 * @param interestRate - Weekly interest rate (default 0% - no interest)
 * @param weeks - Number of weeks (default 10)
 * @returns Total interest paid (always 0 - no interest)
 */
export function calculateTotalInterestSimple(
  principal: number,
  interestRate: number = 0.0,
  weeks: number = 10
): number {
  return 0; // No interest
}

/**
 * Generate payment schedule for a loan
 * @param principal - Original loan amount
 * @param weeklyPrincipalPayment - Principal payment per week
 * @param interestRate - Weekly interest rate
 * @param weeks - Number of weeks
 * @param method - Interest calculation method
 * @returns Array of weekly payment details
 */
export function generatePaymentSchedule(
  principal: number,
  weeklyPrincipalPayment: number = 100,
  interestRate: number = 0.0,
  weeks: number = 10,
  method: InterestMethod = "DECLINING"
): Array<{
  week: number;
  principalRemaining: number;
  principalPayment: number;
  interest: number;
  totalPayment: number;
  newBalance: number;
}> {
  const schedule: Array<{
    week: number;
    principalRemaining: number;
    principalPayment: number;
    interest: number;
    totalPayment: number;
    newBalance: number;
  }> = [];

  let remaining = principal;

  for (let week = 1; week <= weeks; week++) {
    const interest = 0; // No interest

    const principalPayment = Math.min(weeklyPrincipalPayment, remaining);
    const totalPayment = principalPayment; // Only principal
    const newBalance = Math.max(0, remaining - principalPayment);

    schedule.push({
      week,
      principalRemaining: remaining,
      principalPayment,
      interest: 0, // No interest
      totalPayment: Math.round(totalPayment * 100) / 100,
      newBalance: Math.round(newBalance * 100) / 100,
    });

    remaining = newBalance;
  }

  return schedule;
}

/**
 * Calculate loan amount for a group cycle
 * @param totalMembers - Number of active members
 * @param weeklyAmount - Weekly contribution per member (default ₹100)
 * @returns Total loan amount available
 */
export function calculateLoanAmount(
  totalMembers: number,
  weeklyAmount: number = 100
): number {
  return totalMembers * weeklyAmount;
}

/**
 * Calculate late payment penalty
 * @param overdueWeeks - Number of weeks payment is overdue
 * @param baseAmount - Base amount for penalty calculation
 * @param penaltyRate - Penalty rate per week (default 0% - no penalty)
 * @returns Penalty amount (always 0 - no penalty)
 */
export function calculateLatePenalty(
  overdueWeeks: number,
  baseAmount: number,
  penaltyRate: number = 0.0
): number {
  return 0; // No penalty
}

/**
 * Calculate group fund allocations
 * @param interestPool - Total interest collected
 * @param reservePercentage - Percentage for emergency reserve (default 10%)
 * @param insurancePercentage - Percentage for insurance fund (default 5%)
 * @param adminFeePercentage - Percentage for admin fee (default 0.5%)
 * @returns Fund allocation breakdown
 */
export function calculateGroupFundAllocation(
  interestPool: number,
  reservePercentage: number = 10,
  insurancePercentage: number = 5,
  adminFeePercentage: number = 0.5
): {
  emergencyReserve: number;
  insuranceFund: number;
  adminFee: number;
  distributable: number;
} {
  const emergencyReserve =
    Math.round(((interestPool * reservePercentage) / 100) * 100) / 100;
  const insuranceFund =
    Math.round(((interestPool * insurancePercentage) / 100) * 100) / 100;
  const adminFee =
    Math.round(((interestPool * adminFeePercentage) / 100) * 100) / 100;
  const distributable =
    interestPool - emergencyReserve - insuranceFund - adminFee;

  return {
    emergencyReserve,
    insuranceFund,
    adminFee,
    distributable: Math.round(distributable * 100) / 100,
  };
}
