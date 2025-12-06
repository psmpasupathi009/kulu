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
import { generatePaymentSchedule } from "@/lib/utils";
import type { InterestMethod } from "@prisma/client";

interface LoanTransaction {
  id: string;
  date: string;
  amount: number;
  interest: number;
  remaining: number;
  week: number;
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
  interestRate: number;
  interestMethod: string;
  status: string;
  totalInterest: number;
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
    isLate: false,
    overdueWeeks: 0,
  });

  // Calculate weekly payment amount based on loan
  const calculateWeeklyPayment = (loan: Loan) => {
    if (!loan) return { principal: 0, interest: 0, total: 0 };
    const weeklyPrincipal = loan.principal / loan.weeks;
    const weeklyInterest = (loan.remaining * loan.interestRate) / 100;
    return {
      principal: weeklyPrincipal,
      interest: weeklyInterest,
      total: weeklyPrincipal + weeklyInterest,
    };
  };

  // Calculate missed weeks and penalties
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

    // Calculate penalty for missed weeks
    let accumulatedInterest = 0;
    let accumulatedPenalty = 0;
    if (missedWeeks > 0) {
      let tempRemaining = loan.remaining;
      for (let i = 0; i < missedWeeks; i++) {
        const missedWeekInterest = (tempRemaining * loan.interestRate) / 100;
        accumulatedInterest += missedWeekInterest;
        accumulatedPenalty += (tempRemaining * 0.5) / 100;
      }
    }

    return {
      missedWeeks,
      expectedWeek,
      isLate: missedWeeks > 0,
      accumulatedInterest,
      accumulatedPenalty,
      totalPenalty: accumulatedInterest + accumulatedPenalty,
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
          isLate: paymentForm.isLate,
          overdueWeeks: paymentForm.overdueWeeks,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        let successMessage = `Payment of ₹${data.payment.total.toFixed(
          2
        )} recorded successfully!`;

        if (data.payment.missedWeeks > 0) {
          successMessage += `\n⚠️ ${
            data.payment.missedWeeks
          } week(s) missed - Penalty: ₹${data.payment.latePenalty.toFixed(
            2
          )} included.`;
        }

        setSuccess(successMessage);
        setShowPaymentForm(false);
        setPaymentForm({
          paymentDate: new Date().toISOString().split("T")[0],
          isLate: false,
          overdueWeeks: 0,
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

  const paymentSchedule = loan
    ? generatePaymentSchedule(
        loan.principal,
        100, // Weekly principal payment
        loan.interestRate,
        loan.weeks,
        loan.interestMethod as InterestMethod
      )
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
              <span className="font-medium">{loan.interestRate}% per week</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Progress:</span>
              <span className="font-medium">
                {loan.currentWeek}/{loan.weeks} weeks
              </span>
            </div>
            {loan.status === "ACTIVE" && loan.remaining > 0 && (
              <>
                {missedWeeksInfo.missedWeeks > 0 && (
                  <div className="flex justify-between border-t pt-2 mt-2 items-center">
                    <span className="font-semibold text-red-600">
                      <AlertTriangle className="h-4 w-4 inline mr-1" />
                      Missed Weeks:
                    </span>
                    <span className="font-bold text-lg text-red-600">
                      {missedWeeksInfo.missedWeeks} week(s)
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-muted-foreground font-semibold">
                    Weekly Payment:
                  </span>
                  <span
                    className={`font-bold text-lg ${
                      missedWeeksInfo.missedWeeks > 0
                        ? "text-red-600"
                        : "text-blue-600"
                    }`}>
                    ₹
                    {(
                      weeklyPayment.total + (missedWeeksInfo.totalPenalty ?? 0)
                    ).toFixed(2)}
                    {missedWeeksInfo.missedWeeks > 0 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        (includes penalty)
                      </span>
                    )}
                  </span>
                </div>
              </>
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interest Method:</span>
              <span className="font-medium">
                {loan.interestMethod === "DECLINING"
                  ? "Declining Balance"
                  : "Simple"}
              </span>
            </div>
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
                Total Interest Paid:
              </span>
              <span className="font-medium">
                ₹{loan.totalInterest.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Total Principal Paid:
              </span>
              <span className="font-medium">
                ₹{loan.totalPrincipalPaid.toFixed(2)}
              </span>
            </div>
            {loan.latePaymentPenalty > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Late Penalty:</span>
                <span className="font-medium text-red-600">
                  ₹{loan.latePaymentPenalty.toFixed(2)}
                </span>
              </div>
            )}
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
                      {missedWeeksInfo.missedWeeks > 0 && (
                        <Alert variant="destructive" className="mb-3">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <div className="font-semibold mb-1">
                              ⚠️ {missedWeeksInfo.missedWeeks} Week(s) Missed
                              Payment
                            </div>
                            <div className="text-sm space-y-1">
                              <div className="text-red-600">
                                Expected Week: {missedWeeksInfo.expectedWeek} |
                                Current: {loan.currentWeek + 1}
                              </div>
                              <div className="text-red-600">
                                Accumulated Interest: ₹
                                {(missedWeeksInfo.accumulatedInterest ?? 0).toFixed(2)}
                              </div>
                              <div className="text-red-600">
                                Late Penalty: ₹
                                {(missedWeeksInfo.accumulatedPenalty ?? 0).toFixed(2)}{" "}
                                (0.5% per week)
                              </div>
                              <div className="font-semibold mt-1 text-red-600">
                                Additional Amount Due: ₹
                                {(missedWeeksInfo.totalPenalty ?? 0).toFixed(2)}
                              </div>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}

                      <div
                        className={`p-3 rounded-lg border ${
                          missedWeeksInfo.missedWeeks > 0
                            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                            : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                        }`}>
                        <div
                          className={`text-sm font-semibold mb-2 ${
                            missedWeeksInfo.missedWeeks > 0
                              ? "text-red-900 dark:text-red-100"
                              : "text-blue-900 dark:text-blue-100"
                          }`}>
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
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Interest ({loan.interestRate}%):
                            </span>
                            <span className="font-medium">
                              ₹{weeklyPayment.interest.toFixed(2)}
                            </span>
                          </div>
                          {missedWeeksInfo.missedWeeks > 0 && (
                            <>
                              <div className="flex justify-between text-red-600">
                                <span className="text-muted-foreground">
                                  Accumulated Interest (
                                  {missedWeeksInfo.missedWeeks} weeks):
                                </span>
                                <span className="font-medium">
                                  ₹
                                  {(missedWeeksInfo.accumulatedInterest ?? 0).toFixed(
                                    2
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between text-red-600">
                                <span className="text-muted-foreground">
                                  Late Penalty:
                                </span>
                                <span className="font-medium">
                                  ₹
                                  {(missedWeeksInfo.accumulatedPenalty ?? 0).toFixed(
                                    2
                                  )}
                                </span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between border-t pt-1 mt-1">
                            <span className="font-semibold">
                              Total Payment:
                            </span>
                            <span
                              className={`font-bold ${
                                missedWeeksInfo.missedWeeks > 0
                                  ? "text-red-600"
                                  : "text-blue-600"
                              }`}>
                              ₹
                              {(
                                weeklyPayment.total +
                                (missedWeeksInfo.totalPenalty ?? 0)
                              ).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <FieldDescription className="mt-2">
                          {missedWeeksInfo.missedWeeks > 0
                            ? "Penalties for missed weeks are automatically included"
                            : "This amount will be automatically calculated and recorded"}
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
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={paymentForm.isLate}
                            onChange={(e) =>
                              setPaymentForm({
                                ...paymentForm,
                                isLate: e.target.checked,
                                overdueWeeks: e.target.checked
                                  ? paymentForm.overdueWeeks
                                  : 0,
                              })
                            }
                            className="rounded"
                          />
                          <span className="text-sm">
                            This is a late payment
                          </span>
                        </label>
                      </Field>
                      {paymentForm.isLate && (
                        <Field>
                          <FieldLabel htmlFor="overdueWeeks">
                            Overdue Weeks
                          </FieldLabel>
                          <Input
                            id="overdueWeeks"
                            type="number"
                            min="0"
                            value={paymentForm.overdueWeeks}
                            onChange={(e) =>
                              setPaymentForm({
                                ...paymentForm,
                                overdueWeeks: parseInt(e.target.value) || 0,
                              })
                            }
                          />
                          <FieldDescription>
                            Number of weeks overdue (0.5% penalty per week)
                          </FieldDescription>
                        </Field>
                      )}
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
                Complete 10-week payment breakdown with declining balance
                interest
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
                    <TableHead>Interest (1%)</TableHead>
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
                        <TableCell>₹{schedule.interest.toFixed(2)}</TableCell>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Interest:</span>
                  <span className="ml-2 font-medium">
                    ₹
                    {paymentSchedule
                      .reduce((sum, s) => sum + s.interest, 0)
                      .toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Total Repayment:
                  </span>
                  <span className="ml-2 font-medium">
                    ₹
                    {paymentSchedule
                      .reduce((sum, s) => sum + s.totalPayment, 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {loan.status === "COMPLETED" &&
        loan.interestDistributions &&
        loan.interestDistributions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Interest Distribution</CardTitle>
              <CardDescription className="mt-1">
                Interest distributed to group members after loan completion
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      Total Interest Distributed:
                    </span>
                    <span className="text-lg font-bold text-blue-600">
                      ₹
                      {loan.interestDistributions
                        .reduce((sum, dist) => sum + dist.amount, 0)
                        .toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Distributed on:{" "}
                    {format(
                      new Date(loan.interestDistributions[0].distributionDate),
                      "dd/MM/yyyy"
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>User ID</TableHead>
                        <TableHead>Total Contributed</TableHead>
                        <TableHead>Interest Received</TableHead>
                        <TableHead>Distribution Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loan.interestDistributions.map((distribution) => {
                        const totalContributed =
                          distribution.groupMember.totalContributed;
                        const totalInterest =
                          loan.interestDistributions!.reduce(
                            (sum, d) => sum + d.amount,
                            0
                          );
                        const contributionPercentage =
                          totalInterest > 0
                            ? (distribution.amount / totalInterest) * 100
                            : 0;

                        return (
                          <TableRow key={distribution.id}>
                            <TableCell className="font-medium">
                              {distribution.groupMember.member.name}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {distribution.groupMember.member.userId}
                            </TableCell>
                            <TableCell>
                              ₹{totalContributed.toFixed(2)}
                            </TableCell>
                            <TableCell className="font-semibold text-green-600">
                              ₹{distribution.amount.toFixed(2)}
                              <span className="text-xs text-muted-foreground ml-2">
                                ({contributionPercentage.toFixed(1)}%)
                              </span>
                            </TableCell>
                            <TableCell>
                              {format(
                                new Date(distribution.distributionDate),
                                "dd/MM/yyyy"
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                  <TableHead>Amount</TableHead>
                  <TableHead>Interest</TableHead>
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
                      <TableCell>₹{transaction.interest.toFixed(2)}</TableCell>
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
