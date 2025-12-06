"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { ArrowLeft, Calendar, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";

interface LoanTransaction {
  id: string;
  date: string;
  amount: number;
  remaining: number;
  week: number;
  paymentMethod?: string;
}

interface Loan {
  id: string;
  member: {
    name: string;
    userId: string;
  };
  cycle?: {
    cycleNumber: number;
    startDate: string;
    totalMembers: number;
    weeklyAmount: number;
  } | null;
  sequence?: {
    week: number;
    loanAmount: number;
    status: string;
  } | null;
  principal: number;
  remaining: number;
  currentWeek: number;
  weeks: number;
  status: string;
  disbursementMethod?: string;
  totalPrincipalPaid: number;
  latePaymentPenalty: number;
  disbursedAt?: string | null;
  completedAt?: string | null;
  guarantor1?: {
    name: string;
    userId: string;
  } | null;
  guarantor2?: {
    name: string;
    userId: string;
  } | null;
  transactions: LoanTransaction[];
  interestDistributions?: InterestDistribution[];
}

interface InterestDistribution {
  id: string;
  amount: number;
  distributionDate: string;
  groupMember: {
    member: {
      name: string;
      userId: string;
    };
    totalContributed: number;
  };
}

export default function LoanDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [repaying, setRepaying] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "" as "CASH" | "UPI" | "BANK_TRANSFER" | "",
  });

  // Calculate weekly payment amount based on loan (no interest, no penalty)
  const calculateWeeklyPayment = (loan: Loan) => {
    if (!loan) return { principal: 0, interest: 0, total: 0 };
    const weeklyPrincipal = loan.principal / loan.weeks;
    return {
      principal: weeklyPrincipal,
      interest: 0, // No interest
      total: weeklyPrincipal, // Only principal
    };
  };

  // Calculate missed weeks (no penalties)
  const calculateMissedWeeks = (loan: Loan) => {
    if (!loan || !loan.disbursedAt)
      return {
        missedWeeks: 0,
        expectedWeek: loan?.currentWeek || 0,
        isLate: false,
      };

    const disbursedDate = new Date(loan.disbursedAt);
    const today = new Date();
    const weeksSinceDisbursal = Math.floor(
      (today.getTime() - disbursedDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    const expectedWeek = weeksSinceDisbursal + 1;
    const missedWeeks = Math.max(0, expectedWeek - loan.currentWeek - 1);

    // No penalties
    return {
      missedWeeks,
      expectedWeek,
      isLate: false, // No late payment concept
      accumulatedInterest: 0,
      accumulatedPenalty: 0,
      totalPenalty: 0,
    };
  };

  const weeklyPayment = loan
    ? calculateWeeklyPayment(loan)
    : { principal: 0, interest: 0, total: 0 };

  const missedWeeksInfo = loan
    ? calculateMissedWeeks(loan)
    : {
        missedWeeks: 0,
        expectedWeek: 0,
        isLate: false,
        accumulatedInterest: 0,
        accumulatedPenalty: 0,
        totalPenalty: 0,
      };
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (params.id) {
      fetchLoan(params.id as string);
    }
  }, [params.id]);

  const fetchLoan = async (id: string) => {
    try {
      const response = await fetch(`/api/loans/${id}`);
      if (response.ok) {
        const data = await response.json();
        setLoan(data.loan);
      }
    } catch (error) {
      console.error("Error fetching loan:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRepay = async () => {
    if (!loan) return;

    setError("");
    setSuccess("");
    setRepaying(true);
    try {
      const response = await fetch("/api/loans/repay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId: loan.id,
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const successMessage = `Payment of ₹${data.payment.total.toFixed(
          2
        )} recorded successfully!`;

        setSuccess(successMessage);
        setShowPaymentForm(false);
        setPaymentForm({
          paymentDate: new Date().toISOString().split("T")[0],
          paymentMethod: "",
        });
        // Refresh loan data
        await fetchLoan(loan.id);
        setTimeout(() => setSuccess(""), 5000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to record payment");
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      setError("Failed to record payment");
    } finally {
      setRepaying(false);
    }
  };

  const handleMarkDefaulted = async () => {
    if (
      !loan ||
      !confirm("Mark this loan as defaulted? This action cannot be undone.")
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/loans/${loan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "DEFAULTED",
        }),
      });

      if (response.ok) {
        setSuccess("Loan marked as defaulted");
        await fetchLoan(loan.id);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to update loan status");
      }
    } catch (error) {
      console.error("Error updating loan:", error);
      setError("Failed to update loan status");
    }
  };

  // Simple payment schedule - no interest, only principal
  const paymentSchedule = loan
    ? Array.from({ length: loan.weeks }, (_, i) => {
        const week = i + 1;
        const weeklyPrincipal = loan.principal / loan.weeks;
        const principalRemaining = loan.principal - weeklyPrincipal * i;
        const principalPayment = weeklyPrincipal;
        const newBalance = Math.max(0, principalRemaining - principalPayment);
        return {
          week,
          principalRemaining,
          principalPayment,
          interestPayment: 0,
          totalPayment: principalPayment,
          newBalance,
        };
      })
    : [];

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!loan) {
    return <div>Loan not found</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/dashbaord/loans">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold truncate">
            Loan Details
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 truncate">
            {loan.member.name} - {loan.member.userId}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Loan Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Principal:</span>
              <span className="font-medium">₹{loan.principal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining:</span>
              <span className="font-medium">₹{loan.remaining.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interest Rate:</span>
              <span className="font-medium">0% (No interest)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Progress:</span>
              <span className="font-medium">
                {loan.currentWeek}/{loan.weeks} weeks
              </span>
            </div>
            {loan.status === "ACTIVE" && loan.remaining > 0 && (
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="text-muted-foreground font-semibold">
                  Weekly Payment:
                </span>
                <span className="font-bold text-lg text-blue-600">
                  ₹{weeklyPayment.total.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span
                className={`font-medium ${
                  loan.status === "COMPLETED"
                    ? "text-green-600"
                    : loan.status === "ACTIVE"
                    ? "text-blue-600"
                    : loan.status === "DEFAULTED"
                    ? "text-red-600"
                    : "text-gray-600"
                }`}>
                {loan.status}
              </span>
            </div>
            {loan.disbursementMethod && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Disbursement Method:</span>
                <span className="font-medium">
                  {loan.disbursementMethod === "CASH"
                    ? "Cash"
                    : loan.disbursementMethod === "UPI"
                    ? "UPI"
                    : "Bank Transfer"}
                </span>
              </div>
            )}
            {loan.cycle && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cycle:</span>
                <span className="font-medium">#{loan.cycle.cycleNumber}</span>
              </div>
            )}
            {loan.sequence && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rotation Week:</span>
                <span className="font-medium">Week {loan.sequence.week}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Total Principal Paid:
              </span>
              <span className="font-medium">
                ₹{loan.totalPrincipalPaid.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Remaining Balance:
              </span>
              <span className="font-medium">
                ₹{loan.remaining.toFixed(2)}
              </span>
            </div>
            {loan.guarantor1 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Guarantor 1:</span>
                <span className="font-medium">{loan.guarantor1.name}</span>
              </div>
            )}
            {loan.guarantor2 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Guarantor 2:</span>
                <span className="font-medium">{loan.guarantor2.name}</span>
              </div>
            )}
            {loan.status === "ACTIVE" && loan.remaining > 0 && (
              <div className="pt-4 border-t space-y-2">
                {!showPaymentForm ? (
                  <Button
                    className="w-full"
                    onClick={() => setShowPaymentForm(true)}>
                    Record Weekly Payment
                  </Button>
                ) : (
                  <Card className="border-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Record Payment</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {error && (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      {success && (
                        <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                          <AlertDescription className="text-green-800 dark:text-green-200">
                            {success}
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                        <div className="text-sm font-semibold mb-2 text-blue-900 dark:text-blue-100">
                          Payment Breakdown
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Principal:
                            </span>
                            <span className="font-medium">
                              ₹{weeklyPayment.principal.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between border-t pt-1 mt-1">
                            <span className="font-semibold">
                              Total Payment:
                            </span>
                            <span className="font-bold text-blue-600">
                              ₹{weeklyPayment.total.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <FieldDescription className="mt-2">
                          Only principal payment (no interest, no penalty)
                        </FieldDescription>
                      </div>
                      <Field>
                        <FieldLabel htmlFor="paymentDate">
                          <Calendar className="mr-2 h-4 w-4 inline" />
                          Payment Date
                        </FieldLabel>
                        <Input
                          id="paymentDate"
                          type="date"
                          value={paymentForm.paymentDate}
                          onChange={(e) =>
                            setPaymentForm({
                              ...paymentForm,
                              paymentDate: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="paymentMethod">
                          Payment Method
                        </FieldLabel>
                        <select
                          id="paymentMethod"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={paymentForm.paymentMethod}
                          onChange={(e) =>
                            setPaymentForm({
                              ...paymentForm,
                              paymentMethod: e.target.value as "CASH" | "UPI" | "BANK_TRANSFER" | "",
                            })
                          }>
                          <option value="">Select payment method</option>
                          <option value="CASH">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="BANK_TRANSFER">Bank Transfer</option>
                        </select>
                        <FieldDescription>
                          Select the method used for this payment
                        </FieldDescription>
                      </Field>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          className="flex-1"
                          onClick={handleRepay}
                          disabled={repaying}>
                          {repaying ? "Processing..." : "Record Payment"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowPaymentForm(false);
                            setError("");
                            setSuccess("");
                          }}
                          disabled={repaying}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
            {user?.role === "ADMIN" && loan.status === "ACTIVE" && (
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleMarkDefaulted}>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Mark as Defaulted
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>Payment Schedule</CardTitle>
              <CardDescription className="mt-1">
                Complete 10-week payment breakdown (principal only, no interest)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSchedule(!showSchedule)}
              className="w-full sm:w-auto">
              {showSchedule ? "Hide" : "Show"} Schedule
            </Button>
          </div>
        </CardHeader>
        {showSchedule && (
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Week</TableHead>
                    <TableHead>Principal Remaining</TableHead>
                    <TableHead>Principal Payment</TableHead>
                    <TableHead>Total Payment</TableHead>
                    <TableHead>New Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentSchedule.map((schedule, index) => {
                    const isPaid = loan.transactions.some(
                      (t) => t.week === schedule.week
                    );
                    return (
                      <TableRow
                        key={schedule.week}
                        className={
                          isPaid ? "bg-green-50 dark:bg-green-900/20" : ""
                        }>
                        <TableCell className="font-medium">
                          {schedule.week}
                          {isPaid && (
                            <CheckCircle2 className="ml-2 h-4 w-4 inline text-green-600" />
                          )}
                        </TableCell>
                        <TableCell>
                          ₹{schedule.principalRemaining.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          ₹{schedule.principalPayment.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-medium">
                          ₹{schedule.totalPayment.toFixed(2)}
                        </TableCell>
                        <TableCell>₹{schedule.newBalance.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 p-3 sm:p-4 bg-muted rounded-lg">
              <div className="text-sm">
                <span className="text-muted-foreground">
                  Total Repayment (Principal Only):
                </span>
                <span className="ml-2 font-medium">
                  ₹
                  {paymentSchedule
                    .reduce((sum, s) => sum + s.totalPayment, 0)
                    .toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                  <TableRow>
                    <TableHead>S.No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Principal Paid</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Week</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                {loan.transactions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  loan.transactions.map((transaction, index) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        {format(new Date(transaction.date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>₹{transaction.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        {transaction.paymentMethod
                          ? transaction.paymentMethod === "CASH"
                            ? "Cash"
                            : transaction.paymentMethod === "UPI"
                            ? "UPI"
                            : "Bank Transfer"
                          : "-"}
                      </TableCell>
                      <TableCell>₹{transaction.remaining.toFixed(2)}</TableCell>
                      <TableCell>{transaction.week}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
