"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Calendar,
  Users,
  DollarSign,
  X,
  Edit,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { CardDescription } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

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
    totalFunds: number;
  } | null;
}

export default function CyclesPage() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<LoanCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [disbursingSequence, setDisbursingSequence] = useState<string | null>(
    null
  );
  const [showDisburseForm, setShowDisburseForm] = useState(false);
  const [members, setMembers] = useState<
    Array<{ id: string; name: string; userId: string }>
  >([]);
  const [disburseForm, setDisburseForm] = useState({
    guarantor1Id: "",
    guarantor2Id: "",
    disbursementMethod: "" as "CASH" | "UPI" | "BANK_TRANSFER" | "",
  });
  const [editingCycle, setEditingCycle] = useState<string | null>(null);
  const [deletingCycle, setDeletingCycle] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    startDate: "",
    endDate: "",
    isActive: true,
    weeklyAmount: 0,
  });
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchCycles();
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const response = await fetch("/api/members");
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members);
      }
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  };

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

  const handleEdit = (cycle: LoanCycle) => {
    setEditingCycle(cycle.id);
    setEditForm({
      startDate: format(new Date(cycle.startDate), "yyyy-MM-dd"),
      endDate: cycle.endDate
        ? format(new Date(cycle.endDate), "yyyy-MM-dd")
        : "",
      isActive: cycle.isActive,
      weeklyAmount: cycle.weeklyAmount,
    });
  };

  const handleUpdate = async () => {
    if (!editingCycle) return;

    setError("");
    try {
      const response = await fetch(`/api/cycles/${editingCycle}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: editForm.startDate,
          endDate: editForm.endDate || null,
          isActive: editForm.isActive,
          weeklyAmount: editForm.weeklyAmount,
        }),
      });

      if (response.ok) {
        setSuccess("Cycle updated successfully!");
        setEditingCycle(null);
        await fetchCycles();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to update cycle");
      }
    } catch (error) {
      console.error("Error updating cycle:", error);
      setError("Failed to update cycle");
    }
  };

  const handleDelete = async () => {
    if (!deletingCycle) return;

    setError("");
    try {
      const response = await fetch(`/api/cycles/${deletingCycle}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSuccess("Cycle deleted successfully!");
        setDeletingCycle(null);
        await fetchCycles();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to delete cycle");
        setDeletingCycle(null);
      }
    } catch (error) {
      console.error("Error deleting cycle:", error);
      setError("Failed to delete cycle");
      setDeletingCycle(null);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Loan Cycles</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Manage loan cycles
          </p>
        </div>
        {user?.role === "ADMIN" && (
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashbaord/cycles/new">
              <Plus className="mr-2 h-4 w-4" />
              New Cycle
            </Link>
          </Button>
        )}
      </div>

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

      {cycles.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No cycles found. Create a new cycle to start giving loans.
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
                  }`}>
                  {cycle.isActive ? "Active" : "Completed"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4">
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
                    <p className="text-sm text-muted-foreground">
                      Weekly Amount
                    </p>
                    <p className="font-medium">₹{cycle.weeklyAmount}</p>
                  </div>
                </div>
                {cycle.groupFund && (
                  <div>
                    <p className="text-sm text-muted-foreground">Total Funds</p>
                    <p className="font-medium">
                      ₹{cycle.groupFund.totalFunds.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              {cycle.groupFund && (
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 p-3 sm:p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Investment Pool
                    </p>
                    <p className="font-medium">
                      ₹{cycle.groupFund.investmentPool.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-base sm:text-lg font-semibold mb-2">
                  Loan Rotation Schedule
                </h3>
                <div className="overflow-x-auto">
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
                          <TableCell className="font-medium">
                            Week {sequence.week}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {sequence.member.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {sequence.member.userId}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            ₹{sequence.loanAmount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 text-xs rounded ${
                                sequence.status === "COMPLETED"
                                  ? "bg-green-100 text-green-800"
                                  : sequence.status === "DISBURSED"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}>
                              {sequence.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            {sequence.loan
                              ? `₹${sequence.loan.remaining.toFixed(2)}`
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {sequence.status === "PENDING" &&
                                user?.role === "ADMIN" && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => {
                                      setDisbursingSequence(sequence.id);
                                      setShowDisburseForm(true);
                                      setDisburseForm({
                                        guarantor1Id: "",
                                        guarantor2Id: "",
                                        disbursementMethod: "",
                                      });
                                    }}>
                                    Disburse
                                  </Button>
                                )}
                              {sequence.loan && (
                                <Button variant="outline" size="sm" asChild>
                                  <Link
                                    href={`/dashbaord/loans/${sequence.loan.id}`}>
                                    View Loan
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {showDisburseForm && disbursingSequence && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Disburse Loan</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowDisburseForm(false);
                    setDisbursingSequence(null);
                  }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                Select guarantors (optional) for this loan. Guarantors will be
                responsible if the borrower defaults.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Guarantor 1 (Optional)</FieldLabel>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={disburseForm.guarantor1Id}
                    onChange={(e) =>
                      setDisburseForm({
                        ...disburseForm,
                        guarantor1Id: e.target.value,
                      })
                    }>
                    <option value="">None</option>
                    {members
                      .filter((m) => m.id !== disburseForm.guarantor2Id)
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({member.userId})
                        </option>
                      ))}
                  </select>
                  <FieldDescription>
                    First co-signer for this loan
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Guarantor 2 (Optional)</FieldLabel>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={disburseForm.guarantor2Id}
                    onChange={(e) =>
                      setDisburseForm({
                        ...disburseForm,
                        guarantor2Id: e.target.value,
                      })
                    }>
                    <option value="">None</option>
                    {members
                      .filter((m) => m.id !== disburseForm.guarantor1Id)
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({member.userId})
                        </option>
                      ))}
                  </select>
                  <FieldDescription>
                    Second co-signer for this loan
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Disbursement Method</FieldLabel>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={disburseForm.disbursementMethod}
                    onChange={(e) =>
                      setDisburseForm({
                        ...disburseForm,
                        disbursementMethod: e.target.value as "CASH" | "UPI" | "BANK_TRANSFER" | "",
                      })
                    }>
                    <option value="">Select method</option>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                  <FieldDescription>
                    Method used to disburse the loan amount
                  </FieldDescription>
                </Field>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={async () => {
                      try {
                        const response = await fetch("/api/loans/disburse", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            sequenceId: disbursingSequence,
                            disbursementMethod: disburseForm.disbursementMethod || undefined,
                            guarantor1Id:
                              disburseForm.guarantor1Id || undefined,
                            guarantor2Id:
                              disburseForm.guarantor2Id || undefined,
                          }),
                        });
                        if (response.ok) {
                          alert("Loan disbursed successfully!");
                          setShowDisburseForm(false);
                          setDisbursingSequence(null);
                          fetchCycles();
                        } else {
                          const error = await response.json();
                          alert(error.error || "Failed to disburse loan");
                        }
                      } catch (error) {
                        alert("Failed to disburse loan");
                      }
                    }}>
                    Disburse Loan
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDisburseForm(false);
                      setDisbursingSequence(null);
                    }}>
                    Cancel
                  </Button>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Cycle Dialog */}
      {editingCycle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto m-4">
            <CardHeader>
              <CardTitle>Edit Cycle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field>
                <FieldLabel htmlFor="startDate">Start Date</FieldLabel>
                <Input
                  id="startDate"
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, startDate: e.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="endDate">End Date (Optional)</FieldLabel>
                <Input
                  id="endDate"
                  type="date"
                  value={editForm.endDate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, endDate: e.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="weeklyAmount">Weekly Amount</FieldLabel>
                <Input
                  id="weeklyAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.weeklyAmount}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      weeklyAmount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </Field>
              <Field>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) =>
                      setEditForm({ ...editForm, isActive: e.target.checked })
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Active</span>
                </label>
              </Field>
              <div className="flex gap-2">
                <Button onClick={handleUpdate} className="flex-1">
                  Update
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditingCycle(null)}
                  className="flex-1">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deletingCycle !== null}
        onOpenChange={(open) => !open && setDeletingCycle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cycle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this cycle? This action cannot be
              undone. The cycle can only be deleted if it has no active or
              pending loans.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
