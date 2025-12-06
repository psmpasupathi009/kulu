"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, DollarSign, Percent, Calendar } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

export default function NewGroupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    weeklyAmount: "", // Optional - can be empty
    interestRate: 0.0,
    loanWeeks: 10,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          weeklyAmount:
            formData.weeklyAmount && formData.weeklyAmount !== ""
              ? parseFloat(formData.weeklyAmount)
              : undefined,
          interestRate: 0.0, // No interest
          loanWeeks: formData.loanWeeks,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create group");
      }

      setSuccess("Group created successfully!");
      setTimeout(() => {
        router.push("/dashbaord/groups");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to create group");
    } finally {
      setSubmitting(false);
    }
  };

  if (user?.role !== "ADMIN") {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            Access denied. Admin privileges required.
          </AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <Link href="/dashbaord/groups">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Groups
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/dashbaord/groups">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Create Group</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Set up a new savings and loan group
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Group Information</CardTitle>
          <CardDescription>
            Configure the group parameters. Members can join at any week and invest weekly. 
            New members joining mid-cycle need to pay backdated weekly payments. 
            Loans are given from the pool and repaid within 10 weeks (principal only). 
            When loans are completed, the collected amount is distributed as savings to all members.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <FieldGroup>
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

              <Field>
                <FieldLabel htmlFor="name">
                  Group Name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="name"
                  type="text"
                  placeholder="Group 1"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
                <FieldDescription>Name for this group</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="weeklyAmount">
                  <DollarSign className="mr-2 h-4 w-4 inline" />
                  Suggested Weekly Amount (Optional)
                </FieldLabel>
                <Input
                  id="weeklyAmount"
                  type="number"
                  min="1"
                  step="0.01"
                  value={formData.weeklyAmount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      weeklyAmount: e.target.value,
                    })
                  }
                  placeholder="100"
                />
                <FieldDescription>
                  Suggested default amount (₹). Each member can set their own
                  weekly contribution amount when joining. Leave empty if no
                  default.
                </FieldDescription>
              </Field>


              <Field>
                <FieldLabel htmlFor="loanWeeks">
                  <Calendar className="mr-2 h-4 w-4 inline" />
                  Loan Repayment Weeks{" "}
                  <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="loanWeeks"
                  type="number"
                  min="1"
                  value={formData.loanWeeks}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      loanWeeks: parseInt(e.target.value) || 10,
                    })
                  }
                  required
                />
                <FieldDescription>
                  Number of weeks for loan repayment (default: 10 weeks)
                </FieldDescription>
              </Field>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Group Information:</p>
                <p className="text-xs text-muted-foreground">
                  Members can join at any time. Pool amount will be calculated
                  dynamically based on active members each week. Each member can
                  contribute a different amount based on their capacity.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Members receive benefits based on their joining week and
                  contribution amount - earlier joiners who contribute more get
                  proportionally higher benefits.
                </p>
              </div>

              <Field>
                <div className="flex gap-4">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={submitting}>
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      "Create Group"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/dashbaord/groups")}
                    disabled={submitting}>
                    Cancel
                  </Button>
                </div>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
