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
import {
  User,
  UserPlus,
  ArrowLeft,
  Hash,
  Phone,
  MapPin,
  Building2,
  CreditCard,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

export default function NewMemberPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    userId: "",
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
  const [checkingUser, setCheckingUser] = useState(false);
  const [userFound, setUserFound] = useState<{
    name?: string;
    phone?: string;
  } | null>(null);

  const checkUserExists = async (userId: string) => {
    if (!userId.trim()) {
      setUserFound(null);
      setError("");
      return;
    }

    setCheckingUser(true);
    setError("");
    try {
      // Check if member already exists
      const memberResponse = await fetch(`/api/members`);
      if (memberResponse.ok) {
        const memberData = await memberResponse.json();
        const existingMember = memberData.members?.find(
          (m: any) => m.userId === userId.trim()
        );
        if (existingMember) {
          setError(`Member with User ID "${userId}" already exists!`);
          setUserFound(null);
          setCheckingUser(false);
          return;
        }
      }

      // Check if user exists
      const response = await fetch(
        `/api/users/by-userid?userId=${encodeURIComponent(userId.trim())}`
      );
      const data = await response.json();

      if (response.ok && data.user) {
        // User exists - pre-fill details
        setUserFound({
          name: data.user.name || "",
          phone: data.user.phone || "",
        });
        setFormData((prev) => ({
          ...prev,
          name: data.user.name || prev.name,
          phone: data.user.phone || prev.phone,
        }));
        setSuccess(`User found! Pre-filled name and phone from user account.`);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        // User doesn't exist - that's okay, they can still create member
        setUserFound(null);
      }
    } catch (error) {
      console.error("Error checking user:", error);
      setUserFound(null);
    } finally {
      setCheckingUser(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    // Validation
    if (!formData.userId.trim()) {
      setError("User ID is required");
      setSubmitting(false);
      return;
    }

    if (!formData.name.trim()) {
      setError("Name is required");
      setSubmitting(false);
      return;
    }

    if (!formData.email.trim()) {
      setError("Email is required");
      setSubmitting(false);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError("Please enter a valid email address");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: formData.userId.trim(),
          name: formData.name.trim(),
          email: formData.email.trim(),
          fatherName: formData.fatherName.trim() || undefined,
          address1: formData.address1.trim() || undefined,
          address2: formData.address2.trim() || undefined,
          accountNumber: formData.accountNumber.trim() || undefined,
          phone: formData.phone.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create member");
      }

      setSuccess(
        "Member and user account created successfully! The member can now login with their email."
      );
      setTimeout(() => {
        router.push("/dashbaord/members");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to create member");
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
          <Link href="/dashbaord/members">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Members
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/dashbaord/members">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Add New Member</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Create a new member profile
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Member Information</CardTitle>
          <CardDescription>
            Enter all required information to create a new member profile
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
                <FieldLabel htmlFor="userId">
                  <Hash className="mr-2 h-4 w-4 inline" />
                  User ID <span className="text-destructive">*</span>
                  {checkingUser && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Checking...)
                    </span>
                  )}
                </FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="userId"
                    type="text"
                    placeholder="USER001"
                    value={formData.userId}
                    onChange={(e) => {
                      setFormData({ ...formData, userId: e.target.value });
                      setUserFound(null);
                      setSuccess("");
                    }}
                    onBlur={(e) => {
                      if (e.target.value.trim()) {
                        checkUserExists(e.target.value);
                      }
                    }}
                    required
                    className="flex-1"
                  />
                </div>
                <FieldDescription>
                  Unique identifier for this member (must match user account)
                  {userFound && (
                    <span className="block mt-1 text-green-600 dark:text-green-400">
                      ✓ User found! Details pre-filled from user account.
                    </span>
                  )}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="name">
                  <User className="mr-2 h-4 w-4 inline" />
                  Full Name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
                <FieldDescription>Member's full name</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="email">
                  <Mail className="mr-2 h-4 w-4 inline" />
                  Email <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="member@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
                <FieldDescription>
                  Email address for login. A user account will be created
                  automatically.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="fatherName">
                  <User className="mr-2 h-4 w-4 inline" />
                  Father's Name
                </FieldLabel>
                <Input
                  id="fatherName"
                  type="text"
                  placeholder="Father's Name"
                  value={formData.fatherName}
                  onChange={(e) =>
                    setFormData({ ...formData, fatherName: e.target.value })
                  }
                />
                <FieldDescription>
                  Father's or guardian's name (optional)
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="phone">
                  <Phone className="mr-2 h-4 w-4 inline" />
                  Phone Number
                </FieldLabel>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1234567890"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
                <FieldDescription>
                  Contact phone number (optional)
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="accountNumber">
                  <CreditCard className="mr-2 h-4 w-4 inline" />
                  Account Number
                </FieldLabel>
                <Input
                  id="accountNumber"
                  type="text"
                  placeholder="ACC123456"
                  value={formData.accountNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, accountNumber: e.target.value })
                  }
                />
                <FieldDescription>
                  Bank account number (optional, must be unique)
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="address1">
                  <MapPin className="mr-2 h-4 w-4 inline" />
                  Address Line 1
                </FieldLabel>
                <Input
                  id="address1"
                  type="text"
                  placeholder="Street address, P.O. Box"
                  value={formData.address1}
                  onChange={(e) =>
                    setFormData({ ...formData, address1: e.target.value })
                  }
                />
                <FieldDescription>Primary address (optional)</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="address2">
                  <Building2 className="mr-2 h-4 w-4 inline" />
                  Address Line 2
                </FieldLabel>
                <Input
                  id="address2"
                  type="text"
                  placeholder="Apartment, suite, unit, building, floor, etc."
                  value={formData.address2}
                  onChange={(e) =>
                    setFormData({ ...formData, address2: e.target.value })
                  }
                />
                <FieldDescription>
                  Additional address information (optional)
                </FieldDescription>
              </Field>

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
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Create Member
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/dashbaord/members")}
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
