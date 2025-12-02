"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Calendar, Users, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface LoanSequence {
  id: string;
  week: number;
  loanAmount: number;
  status: string;
  disbursedAt?: string | null;
  member: {
    name: string;
    userId: string;
  };
  loan?: {
    id: string;
    status: string;
    remaining: number;
  } | null;
}

interface LoanCycle {
  id: string;
  cycleNumber: number;
  startDate: string;
  endDate?: string | null;
  totalMembers: number;
  weeklyAmount: number;
  isActive: boolean;
  sequences: LoanSequence[];
  groupFund?: {
    investmentPool: number;
    interestPool: number;
    emergencyReserve: number;
    insuranceFund: number;
    adminFee: number;
    totalFunds: number;
  } | null;
}

export default function CyclesPage() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<LoanCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCycles();
  }, []);

  const fetchCycles = async () => {
    try {
      const response = await fetch("/api/cycles");
      if (response.ok) {
        const data = await response.json();
        setCycles(data.cycles);
      } else {
        setError("Failed to fetch cycles");
      }
    } catch (error) {
      console.error("Error fetching cycles:", error);
      setError("Failed to fetch cycles");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Loan Cycles</h1>
          <p className="text-muted-foreground">Manage ROSCA loan rotation cycles</p>
        </div>
        {user?.role === "ADMIN" && (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Cycle
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {cycles.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No cycles found. Create a new cycle to start the ROSCA rotation.
          </CardContent>
        </Card>
      ) : (
        cycles.map((cycle) => (
          <Card key={cycle.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Cycle #{cycle.cycleNumber}</CardTitle>
                <span
                  className={`px-2 py-1 text-xs rounded ${
                    cycle.isActive
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                  }`}
                >
                  {cycle.isActive ? "Active" : "Completed"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">
                      {format(new Date(cycle.startDate), "dd/MM/yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Members</p>
                    <p className="font-medium">{cycle.totalMembers}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Weekly Amount</p>
                    <p className="font-medium">₹{cycle.weeklyAmount}</p>
                  </div>
                </div>
                {cycle.groupFund && (
                  <div>
                    <p className="text-sm text-muted-foreground">Total Funds</p>
                    <p className="font-medium">₹{cycle.groupFund.totalFunds.toFixed(2)}</p>
                  </div>
                )}
              </div>

              {cycle.groupFund && (
                <div className="grid gap-2 md:grid-cols-5 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Investment Pool</p>
                    <p className="font-medium">₹{cycle.groupFund.investmentPool.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Interest Pool</p>
                    <p className="font-medium">₹{cycle.groupFund.interestPool.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Emergency Reserve</p>
                    <p className="font-medium">₹{cycle.groupFund.emergencyReserve.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Insurance Fund</p>
                    <p className="font-medium">₹{cycle.groupFund.insuranceFund.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Admin Fee</p>
                    <p className="font-medium">₹{cycle.groupFund.adminFee.toFixed(2)}</p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold mb-2">Loan Rotation Schedule</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Week</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Loan Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cycle.sequences.map((sequence) => (
                      <TableRow key={sequence.id}>
                        <TableCell className="font-medium">Week {sequence.week}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{sequence.member.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {sequence.member.userId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>₹{sequence.loanAmount.toFixed(2)}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              sequence.status === "COMPLETED"
                                ? "bg-green-100 text-green-800"
                                : sequence.status === "DISBURSED"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {sequence.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {sequence.loan
                            ? `₹${sequence.loan.remaining.toFixed(2)}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {sequence.loan && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={`/dashbaord/loans/${sequence.loan.id}`}>View Loan</a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

