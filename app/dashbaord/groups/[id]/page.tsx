"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Users,
  Calendar,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface GroupMember {
  id: string;
  joiningWeek: number;
  joiningDate: string;
  weeklyAmount: number;
  isActive: boolean;
  totalContributed: number;
  benefitAmount: number;
  member: {
    id: string;
    userId: string;
    name: string;
    phone?: string;
  };
}

interface Group {
  id: string;
  name: string;
  weeklyAmount: number;
  interestRate: number;
  loanWeeks: number;
  isActive: boolean;
  members: GroupMember[];
}

interface Member {
  id: string;
  userId: string;
  name: string;
  phone?: string;
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [formData, setFormData] = useState({
    memberId: "",
    joiningDate: new Date().toISOString().split("T")[0],
    joiningWeek: 1,
    weeklyAmount: 100, // Will be updated when group loads
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchGroup();
      fetchAllMembers();
    }
  }, [params.id]);

  const fetchGroup = async () => {
    try {
      const response = await fetch(`/api/groups/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setGroup(data.group);
        // Update form default weekly amount from group suggestion
        if (data.group.weeklyAmount) {
          setFormData((prev) => ({
            ...prev,
            weeklyAmount: data.group.weeklyAmount || 100,
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching group:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMembers = async () => {
    try {
      // Fetch all members
      const membersResponse = await fetch("/api/members");
      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        setAllMembers(membersData.members);
      }

      // Also fetch admin's member record if admin wants to join
      if (user?.role === "ADMIN") {
        const adminMemberResponse = await fetch("/api/members/admin-member");
        if (adminMemberResponse.ok) {
          const adminMemberData = await adminMemberResponse.json();
          // Add admin member to list if not already there
          if (adminMemberData.member) {
            setAllMembers((prev) => {
              const exists = prev.some(
                (m) => m.id === adminMemberData.member.id
              );
              if (!exists) {
                return [...prev, adminMemberData.member];
              }
              return prev;
            });
          }
        }
      }
    } catch (error) {
      console.error("Error fetching members:", error);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const joiningDate = new Date(formData.joiningDate);
      joiningDate.setHours(0, 0, 0, 0);

      const response = await fetch(`/api/groups/${params.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: formData.memberId,
          joiningDate: joiningDate.toISOString(),
          joiningWeek: formData.joiningWeek,
          weeklyAmount: formData.weeklyAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add member");
      }

      setSuccess("Member added to group successfully!");
      setFormData({
        memberId: "",
        joiningDate: new Date().toISOString().split("T")[0],
        joiningWeek: 1,
        weeklyAmount: group?.weeklyAmount || 100,
      });
      setShowAddMember(false);
      fetchGroup();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to add member");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setError("");
    setRemovingId(memberId);

    try {
      const response = await fetch(
        `/api/groups/${params.id}/members?memberId=${memberId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove member");
      }

      setSuccess("Member removed from group");
      fetchGroup();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!group) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link href="/dashbaord/groups">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Groups
          </Link>
        </Button>
        <div>Group not found</div>
      </div>
    );
  }

  const activeMembers = group.members.filter((m) => m.isActive);
  const availableMembers = allMembers.filter(
    (m) => !group.members.some((gm) => gm.member.id === m.id && gm.isActive)
  );

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" asChild>
            <Link href="/dashbaord/groups">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{group.name}</h1>
            <p className="text-sm text-muted-foreground">
              Manage group members and their joining dates
            </p>
          </div>
        </div>
        {user?.role === "ADMIN" && (
          <Button onClick={() => setShowAddMember(!showAddMember)}>
            <Plus className="mr-2 h-4 w-4" />
            {showAddMember ? "Cancel" : "Add Member"}
          </Button>
        )}
      </div>

      {(error || success) && (
        <Alert
          variant={error ? "destructive" : "default"}
          className={
            success ? "border-green-200 bg-green-50 dark:bg-green-900/20" : ""
          }>
          <AlertDescription
            className={success ? "text-green-800 dark:text-green-200" : ""}>
            {error || success}
          </AlertDescription>
        </Alert>
      )}

      {showAddMember && user?.role === "ADMIN" && (
        <Card>
          <CardHeader>
            <CardTitle>Add Member to Group</CardTitle>
            <CardDescription>
              Add a member to this group. They will start contributing from the
              specified joining week.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddMember} className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="memberId">
                    Member <span className="text-destructive">*</span>
                  </FieldLabel>
                  <select
                    id="memberId"
                    value={formData.memberId}
                    onChange={(e) =>
                      setFormData({ ...formData, memberId: e.target.value })
                    }
                    required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <option value="">Select a member</option>
                    {availableMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.userId})
                      </option>
                    ))}
                  </select>
                  <FieldDescription>
                    Select a member to add to this group. Admin can also join as
                    a member by selecting their member record.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="joiningDate">
                    <Calendar className="mr-2 h-4 w-4 inline" />
                    Joining Date <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="joiningDate"
                    type="date"
                    value={formData.joiningDate}
                    onChange={(e) =>
                      setFormData({ ...formData, joiningDate: e.target.value })
                    }
                    required
                  />
                  <FieldDescription>
                    Date when the member joins the group
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="joiningWeek">
                    Joining Week <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="joiningWeek"
                    type="number"
                    min="1"
                    value={formData.joiningWeek}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        joiningWeek: parseInt(e.target.value) || 1,
                      })
                    }
                    required
                  />
                  <FieldDescription>
                    Week number when member joins (1, 2, 3...). Earlier joiners
                    get more benefits.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="weeklyAmount">
                    <DollarSign className="mr-2 h-4 w-4 inline" />
                    Weekly Contribution Amount{" "}
                    <span className="text-destructive">*</span>
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
                        weeklyAmount: parseFloat(e.target.value) || 100,
                      })
                    }
                    required
                  />
                  <FieldDescription>
                    Amount this member will contribute each week (₹). Each
                    member can have a different amount based on their capacity.
                  </FieldDescription>
                </Field>

                <Field>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full">
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Member
                      </>
                    )}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Group Members</CardTitle>
          <CardDescription>
            Active members: {activeMembers.length}. Each member can contribute a
            different amount weekly based on their capacity. Benefits are
            calculated based on joining week and contribution amount. Members
            who join earlier (lower week number) get more benefits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>S.No</TableHead>
                  <TableHead>Member Name</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Weekly Amount</TableHead>
                  <TableHead>Joining Week</TableHead>
                  <TableHead>Joining Date</TableHead>
                  <TableHead>Total Contributed</TableHead>
                  <TableHead>Benefit Amount</TableHead>
                  <TableHead>Status</TableHead>
                  {user?.role === "ADMIN" && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeMembers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={user?.role === "ADMIN" ? 10 : 9}
                      className="text-center text-muted-foreground">
                      No active members. Add members to start the group.
                    </TableCell>
                  </TableRow>
                ) : (
                  activeMembers.map((gm, index) => (
                    <TableRow key={gm.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {gm.member.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {gm.member.userId}
                      </TableCell>
                      <TableCell>
                        <DollarSign className="h-3 w-3 inline mr-1" />
                        {gm.weeklyAmount.toFixed(2)}
                      </TableCell>
                      <TableCell>Week {gm.joiningWeek}</TableCell>
                      <TableCell>
                        {new Date(gm.joiningDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DollarSign className="h-3 w-3 inline mr-1" />
                        {gm.totalContributed.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <DollarSign className="h-3 w-3 inline mr-1" />
                        {gm.benefitAmount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            gm.isActive
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                          }`}>
                          {gm.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      {user?.role === "ADMIN" && (
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={removingId === gm.id}>
                                <Trash2 className="mr-1 h-3 w-3" />
                                {removingId === gm.id
                                  ? "Removing..."
                                  : "Remove"}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Remove Member?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will deactivate the member from the
                                  group. They will stop contributing from next
                                  week. This action can be reversed by re-adding
                                  them.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleRemoveMember(gm.member.id)
                                  }
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  disabled={removingId === gm.id}>
                                  Remove Member
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      )}
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
