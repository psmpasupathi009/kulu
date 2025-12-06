"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowLeft,
  Edit,
  Trash2,
  User,
  Hash,
  Phone,
  MapPin,
  Building2,
  CreditCard,
  Save,
  X,
  Mail,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
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

interface Member {
  id: string;
  userId: string;
  name: string;
  email?: string;
  fatherName?: string;
  address1?: string;
  address2?: string;
  accountNumber?: string;
  phone?: string;
  photo?: string;
}

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    fatherName: "",
    address1: "",
    address2: "",
    accountNumber: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchMember(params.id as string);
    }
  }, [params.id]);

  const fetchMember = async (id: string) => {
    try {
      const response = await fetch(`/api/members/${id}`);
      if (response.ok) {
        const data = await response.json();
        setMember(data.member);
        setFormData({
          name: data.member.name || "",
          email: data.member.email || "",
          fatherName: data.member.fatherName || "",
          address1: data.member.address1 || "",
          address2: data.member.address2 || "",
          accountNumber: data.member.accountNumber || "",
          phone: data.member.phone || "",
        });
      }
    } catch (error) {
      console.error("Error fetching member:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setError("");
    setSuccess("");

    // Validation
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        setError("Please enter a valid email address");
        return;
      }
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/members/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim() || undefined,
          email: formData.email.trim() || undefined,
          fatherName: formData.fatherName.trim() || undefined,
          address1: formData.address1.trim() || undefined,
          address2: formData.address2.trim() || undefined,
          accountNumber: formData.accountNumber.trim() || undefined,
          phone: formData.phone.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update member");
      }

      setSuccess("Member and user account updated successfully!");
      setIsEditing(false);
      fetchMember(params.id as string);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update member");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setError("");
    setDeleting(true);

    try {
      const response = await fetch(`/api/members/${params.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete member");
      }

      router.push("/dashbaord/members");
    } catch (err: any) {
      setError(err.message || "Failed to delete member");
      setDeleting(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!member) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link href="/dashbaord/members">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Members
          </Link>
        </Button>
        <div>Member not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/dashbaord/members">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold">Member Details</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {user?.role === "ADMIN"
                ? "View and manage member information. You have full control to edit and delete."
                : "View member information"}
            </p>
          </div>
        </div>
        {user?.role === "ADMIN" && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {!isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={deleting}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Are you absolutely sure?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently
                        delete the member
                        <strong className="font-semibold">
                          {" "}
                          {member.name}
                        </strong>{" "}
                        (User ID: {member.userId}) and their associated user
                        account from the database. All related data including
                        savings, loans, and transactions will also be deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deleting}>
                        {deleting ? "Deleting..." : "Delete Member"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={submitting}>
                  <Save className="mr-2 h-4 w-4" />
                  {submitting ? "Saving..." : "Save Changes"}
                </Button>
              </>
            )}
          </div>
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

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            {user?.role === "ADMIN" && isEditing && (
              <p className="text-sm text-muted-foreground mt-1">
                Admin: You can edit all fields. Changes will sync to the user
                account.
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Hash className="h-4 w-4" />
                User ID
              </label>
              <p className="text-lg font-mono">{member.userId}</p>
              <p className="text-xs text-muted-foreground mt-1">
                User ID cannot be changed. To change it, delete and recreate the
                member.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Name
              </label>
              {isEditing ? (
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              ) : (
                <p className="text-lg">{member.name}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </label>
              {isEditing ? (
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="member@example.com"
                />
              ) : (
                <p className="text-lg">{member.email || "-"}</p>
              )}
              {!isEditing && member.email && (
                <p className="text-xs text-muted-foreground mt-1">
                  Used for login. Member can login with this email.
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Father's Name
              </label>
              {isEditing ? (
                <Input
                  type="text"
                  value={formData.fatherName}
                  onChange={(e) =>
                    setFormData({ ...formData, fatherName: e.target.value })
                  }
                />
              ) : (
                <p className="text-lg">{member.fatherName || "-"}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone Number
              </label>
              {isEditing ? (
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              ) : (
                <p className="text-lg">{member.phone || "-"}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Account Number
              </label>
              {isEditing ? (
                <Input
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, accountNumber: e.target.value })
                  }
                />
              ) : (
                <p className="text-lg font-mono">
                  {member.accountNumber || "-"}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Address Line 1
              </label>
              {isEditing ? (
                <Input
                  type="text"
                  value={formData.address1}
                  onChange={(e) =>
                    setFormData({ ...formData, address1: e.target.value })
                  }
                />
              ) : (
                <p className="text-lg">{member.address1 || "-"}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Address Line 2
              </label>
              {isEditing ? (
                <Input
                  type="text"
                  value={formData.address2}
                  onChange={(e) =>
                    setFormData({ ...formData, address2: e.target.value })
                  }
                />
              ) : (
                <p className="text-lg">{member.address2 || "-"}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
