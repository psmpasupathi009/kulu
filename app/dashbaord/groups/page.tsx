"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Group {
  id: string;
  name: string;
  weeklyAmount: number;
  interestRate: number;
  loanWeeks: number;
  isActive: boolean;
  createdAt: string;
  members: Array<{
    id: string;
    joiningWeek: number;
    joiningDate: string;
    isActive: boolean;
    totalContributed: number;
    benefitAmount: number;
    member: {
      id: string;
      userId: string;
      name: string;
      phone?: string;
    };
  }>;
  cycles: Array<{
    id: string;
    cycleNumber: number;
    currentWeek: number;
    isActive: boolean;
  }>;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role === "ADMIN") {
      fetchGroups();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchGroups = async () => {
    try {
      const response = await fetch("/api/groups");
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== "ADMIN") {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>
            Access denied. Only admins can view and manage groups.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">ROSCA Groups</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Manage rotating savings and credit association groups
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/dashbaord/groups/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Group
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Groups List</CardTitle>
          <CardDescription>
            All ROSCA groups in the system. Members can join dynamically at any
            time with different joining weeks. Pool amount is calculated based
            on active members each week. Admin can also join groups as members.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Active Members</TableHead>
                  <TableHead>Weekly Amount</TableHead>
                  <TableHead>Interest Rate</TableHead>
                  <TableHead>Loan Weeks</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground">
                      No groups found. Create your first group above.
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((group) => {
                    const activeMembers = group.members.filter(
                      (m) => m.isActive
                    ).length;
                    return (
                      <TableRow key={group.id}>
                        <TableCell className="font-medium">
                          {group.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {activeMembers}
                          </div>
                        </TableCell>
                        <TableCell>₹{group.weeklyAmount.toFixed(2)}</TableCell>
                        <TableCell>{group.interestRate}%</TableCell>
                        <TableCell>{group.loanWeeks} weeks</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              group.isActive
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                            }`}>
                            {group.isActive ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/dashbaord/groups/${group.id}`}>
                              View
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
