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
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Edit, Trash2, Eye } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Member {
  id: string;
  userId: string;
  name: string;
  fatherName?: string;
  address1?: string;
  accountNumber?: string;
  phone?: string;
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
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
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (memberId: string, memberName: string) => {
    setError("");
    setDeletingId(memberId);

    try {
      const response = await fetch(`/api/members/${memberId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete member");
      }

      // Refresh the list
      fetchMembers();
    } catch (err: any) {
      setError(err.message || "Failed to delete member");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Member Details</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            View and manage all members
          </p>
        </div>
        {user?.role === "ADMIN" && (
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashbaord/members/new">Add Member</Link>
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Member List</CardTitle>
          {user?.role === "ADMIN" && (
            <p className="text-sm text-muted-foreground">
              As admin, you have full control to view, edit, and delete members.
              You can also join groups as a member to receive loans. All changes
              are permanent.
            </p>
          )}
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>S.No</TableHead>
                  <TableHead>Member Name</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground">
                      No members found.{" "}
                      {user?.role === "ADMIN" &&
                        'Click "Add Member" to create your first member.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member, index) => (
                    <TableRow key={member.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {member.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {member.userId}
                      </TableCell>
                      <TableCell>{member.phone || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {member.accountNumber || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="text-xs sm:text-sm">
                            <Link href={`/dashbaord/members/${member.id}`}>
                              <Eye className="mr-1 h-3 w-3" />
                              <span className="hidden sm:inline">View</span>
                            </Link>
                          </Button>
                          {user?.role === "ADMIN" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="text-xs sm:text-sm"
                                onClick={() =>
                                  router.push(`/dashbaord/members/${member.id}`)
                                }>
                                <Link href={`/dashbaord/members/${member.id}`}>
                                  <Edit className="mr-1 h-3 w-3" />
                                  <span className="hidden sm:inline">Edit</span>
                                </Link>
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="text-xs sm:text-sm"
                                    disabled={deletingId === member.id}>
                                    <Trash2 className="mr-1 h-3 w-3" />
                                    <span className="hidden sm:inline">
                                      {deletingId === member.id
                                        ? "Deleting..."
                                        : "Delete"}
                                    </span>
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Delete Member?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will
                                      permanently delete:
                                      <ul className="list-disc list-inside mt-2 space-y-1">
                                        <li>
                                          Member: <strong>{member.name}</strong>{" "}
                                          (ID: {member.userId})
                                        </li>
                                        <li>
                                          Associated user account (login access)
                                        </li>
                                        <li>All savings records</li>
                                        <li>All loan records</li>
                                        <li>All transaction history</li>
                                      </ul>
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() =>
                                        handleDelete(member.id, member.name)
                                      }
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      disabled={deletingId === member.id}>
                                      {deletingId === member.id
                                        ? "Deleting..."
                                        : "Delete Permanently"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </TableCell>
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
