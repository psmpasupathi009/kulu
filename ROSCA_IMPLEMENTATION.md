# ROSCA Financial System Implementation

## Overview
This document describes the implementation of the Rotating Savings and Credit Association (ROSCA) financial system with declining balance interest calculation.

## Key Features Implemented

### 1. Database Schema (Prisma)
- **LoanCycle**: Tracks rotation cycles with start/end dates, member count, weekly amount
- **LoanSequence**: Defines which member receives loan in which week (1-10)
- **Loan**: Enhanced with cycle tracking, guarantors, interest method, status
- **GroupFund**: Manages investment pool, interest pool, emergency reserve, insurance fund, admin fee

### 2. Financial Calculations (`lib/utils.ts`)

#### Declining Balance Interest (Recommended)
- `calculateWeeklyInterest()`: Calculates interest on remaining balance
- `calculateWeeklyPayment()`: Calculates principal + interest for each week
- `calculateTotalInterestDeclining()`: Total interest over 10 weeks (₹55 for ₹1,000 loan)
- `generatePaymentSchedule()`: Full 10-week payment schedule

#### Simple Interest (Alternative)
- `calculateTotalInterestSimple()`: Flat 1% per week on original principal (₹100 for ₹1,000 loan)

#### Group Fund Management
- `calculateGroupFundAllocation()`: Distributes interest pool into:
  - Emergency Reserve: 10%
  - Insurance Fund: 5%
  - Admin Fee: 0.5%
  - Distributable: Remaining

### 3. API Routes

#### `/api/cycles` (GET, POST)
- **GET**: Fetch all loan cycles with sequences and group funds
- **POST**: Create new cycle with member rotation schedule
  - Automatically creates loan sequences for weeks 1-10
  - Creates group fund for the cycle
  - Calculates loan amount based on members × weekly amount

#### `/api/loans` (GET, POST)
- **GET**: Fetch all loans with cycle, sequence, guarantors
- **POST**: Create loan with support for:
  - Interest method (SIMPLE or DECLINING)
  - Cycle and sequence linking
  - Guarantors (up to 2)

#### `/api/loans/disburse` (POST)
- Disburse loan from sequence
- Checks group fund availability
- Updates investment pool
- Links loan to sequence

#### `/api/loans/repay` (POST)
- Process weekly repayment with declining balance interest
- Calculates interest on remaining balance
- Supports late payment penalty (0.5% per week)
- Updates group fund interest pool
- Auto-allocates emergency reserve, insurance, admin fee

#### `/api/funds` (GET, POST)
- **GET**: Fetch group fund status (optionally by cycle)
- **POST**: Add weekly investments to investment pool

#### `/api/savings` (Updated)
- Automatically adds ₹100 weekly contributions to active cycle's investment pool

## Financial Flow Example

### Week 1: Member A Receives Loan
1. All 10 members contribute ₹100 → Investment Pool: ₹1,000
2. Member A receives ₹1,000 loan
3. Investment Pool: ₹0 (disbursed)

### Weeks 2-10: Repayment
**Member A's Payment Schedule (Declining Balance):**
- Week 2: ₹100 principal + ₹10 interest = ₹110 (Balance: ₹900)
- Week 3: ₹100 principal + ₹9 interest = ₹109 (Balance: ₹800)
- Week 4: ₹100 principal + ₹8 interest = ₹108 (Balance: ₹700)
- ...continues...
- Week 10: ₹100 principal + ₹1 interest = ₹101 (Balance: ₹0)
- **Total Interest Paid: ₹55** (vs ₹100 with simple interest)

### Interest Pool Distribution
- Total Interest Collected: ₹55
- Emergency Reserve (10%): ₹5.50
- Insurance Fund (5%): ₹2.75
- Admin Fee (0.5%): ₹0.28
- Distributable: ₹46.47

## Usage Examples

### Create a Cycle
```typescript
POST /api/cycles
{
  "cycleNumber": 1,
  "startDate": "2024-01-01",
  "totalMembers": 10,
  "weeklyAmount": 100,
  "memberIds": ["member1", "member2", ..., "member10"]
}
```

### Disburse Loan (Week 1)
```typescript
POST /api/loans/disburse
{
  "sequenceId": "sequence_id_for_week_1"
}
```

### Process Weekly Repayment
```typescript
POST /api/loans/repay
{
  "loanId": "loan_id",
  "principalPayment": 100,
  "paymentDate": "2024-01-08",
  "isLate": false,
  "overdueWeeks": 0
}
```

### Add Weekly Investment
```typescript
POST /api/funds
{
  "cycleId": "cycle_id",
  "amount": 1000, // 10 members × ₹100
  "date": "2024-01-01"
}
```

## Benefits of Declining Balance Method

1. **Fairer**: Interest decreases as principal is paid
2. **Lower Cost**: ₹55 total interest vs ₹100 with simple interest
3. **Predictable**: Clear payment schedule
4. **Sustainable**: Better for long-term operation

## Next Steps (Dashboard Implementation)

1. Create cycle management page
2. Display loan rotation schedule
3. Show group fund status
4. Display payment schedules with declining balance
5. Show member financial overview
6. Create financial reports

## Database Migration

After updating the schema, run:
```bash
npm run db:push
```

This will update your MongoDB database with the new models.

