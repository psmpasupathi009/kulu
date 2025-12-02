# GSSHG Financial Management System

A comprehensive financial management system for weekly investments and loan repayments with 1% weekly interest rate over 10 weeks.

## Features

- **User Authentication**: OTP-based email verification for users and password-based login for admins
- **Member Management**: Create and manage member profiles with photos
- **Savings Tracking**: Track weekly savings with transaction history
- **Loan Management**: Manage loans with 1% weekly interest rate over 10 weeks
- **Miscellaneous Transactions**: Track various financial transactions
- **Events Management**: Create and manage events with photo uploads
- **Monthly Statements**: Upload and view PDF monthly statements
- **Role-Based Access**: Admin and User roles with different permissions

## Tech Stack

- **Framework**: Next.js 16
- **Database**: MongoDB with Prisma ORM
- **UI**: React, Tailwind CSS, shadcn/ui components
- **Authentication**: JWT-based with OTP email verification
- **Email**: Nodemailer for OTP and password emails

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="mongodb://localhost:27017/gsshg"

# JWT Secret
JWT_SECRET="your-secret-key-change-in-production"

# Admin Email (Admin uses OTP login same as users)
ADMIN_EMAIL="admin@example.com"

# Email Configuration for OTP
# IMPORTANT: For Gmail, you MUST use an App Password, not your regular password
#
# Gmail Setup Steps:
# 1. Enable 2-Step Verification: https://myaccount.google.com/security
# 2. Generate App Password: https://myaccount.google.com/apppasswords
# 3. Select "Mail" and "Other (Custom name)" → Enter "GSSHG"
# 4. Copy the 16-character password and use it below
#
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="xxxx xxxx xxxx xxxx"  # Use App Password for Gmail
EMAIL_FROM="your-email@gmail.com"

# Alternative Email Providers:
# Outlook: EMAIL_HOST="smtp-mail.outlook.com", EMAIL_PORT="587"
# Yahoo: EMAIL_HOST="smtp.mail.yahoo.com", EMAIL_PORT="587"
# Custom: EMAIL_HOST="smtp.yourdomain.com", EMAIL_PORT="587" or "465"
```

### 3. Database Setup

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push
```

### 4. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Project Structure

```
kulu/
├── app/
│   ├── api/              # API routes
│   ├── auth/             # Authentication pages
│   ├── dashbaord/        # Dashboard pages
│   └── layout.tsx        # Root layout
├── components/
│   ├── home/             # Home components
│   ├── nav/              # Navigation components
│   └── ui/               # shadcn UI components
├── lib/
│   ├── auth.ts           # Authentication utilities
│   ├── prisma.ts         # Prisma client
│   └── utils.ts          # Utility functions
├── hooks/
│   └── use-auth.tsx      # Auth hook
├── middleware.ts         # Route protection
└── prisma/
    └── schema.prisma     # Database schema
```

## Authentication

### Admin Login

- Admins use OTP login (same as users)
- Admin email is set in `ADMIN_EMAIL` environment variable
- Admin receives OTP via email to login
- Only admin can create new users

### User Login

- Users enter their email
- OTP is sent to their email
- Users enter the OTP to login

## Financial System

### Weekly Investment System

- Each user invests a set amount every week (e.g., Rs 100)
- Users receive Rs 100 weekly for 10 weeks

### Loan Repayment System

- Loan amount accumulates simple interest at 1% per week
- Users must pay back the principal loan amount plus interest in 10 weeks
- Interest payment is made weekly along with the loan amount
- Total payable weekly = weekly principal + 1% interest on remaining balance

## API Routes

- `/api/auth/send-otp` - Send OTP to email
- `/api/auth/verify-otp` - Verify OTP and login
- `/api/auth/login` - Password-based login
- `/api/auth/logout` - Logout
- `/api/auth/me` - Get current user
- `/api/members` - CRUD operations for members
- `/api/savings` - Savings transactions
- `/api/loans` - Loan management
- `/api/events` - Event management
- `/api/statements` - Monthly statements
- `/api/transactions` - Miscellaneous transactions

## Permissions

### Admin

- Can create, edit, and delete all records
- Can upload photos and PDFs
- Full access to all features

### User

- Can only view details
- Cannot modify any data
- Read-only access

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run Prisma Studio (Database GUI)
npm run db:studio
```

## Notes

- Make sure MongoDB is running before starting the application
- Configure SMTP settings properly for email functionality
- Change JWT_SECRET in production
- Admin user is automatically created on first run if it doesn't exist
