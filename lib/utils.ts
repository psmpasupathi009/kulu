import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// ==================== ROSCA Financial Calculations ====================

export type InterestMethod = "SIMPLE" | "DECLINING"

/**
 * Calculate interest for a given week using declining balance method
 * @param remainingBalance - Current remaining principal
 * @param interestRate - Weekly interest rate (e.g., 1.0 for 1%)
 * @returns Interest amount for this week
 */
export function calculateWeeklyInterest(
  remainingBalance: number,
  interestRate: number = 1.0
): number {
  return (remainingBalance * interestRate) / 100
}

/**
 * Calculate weekly payment for declining balance method
 * @param remainingBalance - Current remaining principal
 * @param principalPayment - Principal payment amount (usually ₹100)
 * @param interestRate - Weekly interest rate (default 1%)
 * @returns Total payment (principal + interest)
 */
export function calculateWeeklyPayment(
  remainingBalance: number,
  principalPayment: number = 100,
  interestRate: number = 1.0
): { principal: number; interest: number; total: number; newBalance: number } {
  const interest = calculateWeeklyInterest(remainingBalance, interestRate)
  const total = principalPayment + interest
  const newBalance = Math.max(0, remainingBalance - principalPayment)

  return {
    principal: principalPayment,
    interest,
    total,
    newBalance,
  }
}

/**
 * Calculate total interest for declining balance method over 10 weeks
 * @param principal - Original loan amount
 * @param weeklyPrincipalPayment - Principal payment per week (default ₹100)
 * @param interestRate - Weekly interest rate (default 1%)
 * @param weeks - Number of weeks (default 10)
 * @returns Total interest paid
 */
export function calculateTotalInterestDeclining(
  principal: number,
  weeklyPrincipalPayment: number = 100,
  interestRate: number = 1.0,
  weeks: number = 10
): number {
  let remaining = principal
  let totalInterest = 0

  for (let week = 1; week <= weeks; week++) {
    const interest = calculateWeeklyInterest(remaining, interestRate)
    totalInterest += interest
    remaining = Math.max(0, remaining - weeklyPrincipalPayment)
  }

  return Math.round(totalInterest * 100) / 100 // Round to 2 decimals
}

/**
 * Calculate total interest for simple interest method
 * @param principal - Original loan amount
 * @param interestRate - Weekly interest rate (default 1%)
 * @param weeks - Number of weeks (default 10)
 * @returns Total interest paid
 */
export function calculateTotalInterestSimple(
  principal: number,
  interestRate: number = 1.0,
  weeks: number = 10
): number {
  const weeklyInterest = (principal * interestRate) / 100
  return Math.round(weeklyInterest * weeks * 100) / 100
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
  interestRate: number = 1.0,
  weeks: number = 10,
  method: InterestMethod = "DECLINING"
): Array<{
  week: number
  principalRemaining: number
  principalPayment: number
  interest: number
  totalPayment: number
  newBalance: number
}> {
  const schedule: Array<{
    week: number
    principalRemaining: number
    principalPayment: number
    interest: number
    totalPayment: number
    newBalance: number
  }> = []

  let remaining = principal

  for (let week = 1; week <= weeks; week++) {
    const interest =
      method === "DECLINING"
        ? calculateWeeklyInterest(remaining, interestRate)
        : (principal * interestRate) / 100

    const principalPayment = Math.min(weeklyPrincipalPayment, remaining)
    const totalPayment = principalPayment + interest
    const newBalance = Math.max(0, remaining - principalPayment)

    schedule.push({
      week,
      principalRemaining: remaining,
      principalPayment,
      interest: Math.round(interest * 100) / 100,
      totalPayment: Math.round(totalPayment * 100) / 100,
      newBalance: Math.round(newBalance * 100) / 100,
    })

    remaining = newBalance
  }

  return schedule
}

/**
 * Calculate loan amount for a ROSCA cycle
 * @param totalMembers - Number of active members
 * @param weeklyAmount - Weekly contribution per member (default ₹100)
 * @returns Total loan amount available
 */
export function calculateLoanAmount(
  totalMembers: number,
  weeklyAmount: number = 100
): number {
  return totalMembers * weeklyAmount
}

/**
 * Calculate late payment penalty
 * @param overdueWeeks - Number of weeks payment is overdue
 * @param baseAmount - Base amount for penalty calculation
 * @param penaltyRate - Penalty rate per week (default 0.5%)
 * @returns Penalty amount
 */
export function calculateLatePenalty(
  overdueWeeks: number,
  baseAmount: number,
  penaltyRate: number = 0.5
): number {
  return Math.round((baseAmount * penaltyRate * overdueWeeks) / 100 * 100) / 100
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
  emergencyReserve: number
  insuranceFund: number
  adminFee: number
  distributable: number
} {
  const emergencyReserve = Math.round((interestPool * reservePercentage) / 100 * 100) / 100
  const insuranceFund = Math.round((interestPool * insurancePercentage) / 100 * 100) / 100
  const adminFee = Math.round((interestPool * adminFeePercentage) / 100 * 100) / 100
  const distributable =
    interestPool - emergencyReserve - insuranceFund - adminFee

  return {
    emergencyReserve,
    insuranceFund,
    adminFee,
    distributable: Math.round(distributable * 100) / 100,
  }
}
