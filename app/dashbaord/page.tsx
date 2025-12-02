"use client";

import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Users,
  PiggyBank,
  CreditCard,
  FileText,
  Calendar,
  FileSpreadsheet,
  Settings,
  Plus,
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();

  const menuItems = [
    {
      title: "Member Details",
      icon: Users,
      href: "/dashbaord/members",
      number: "1",
    },
    {
      title: "Savings",
      icon: PiggyBank,
      href: "/dashbaord/savings",
      number: "2",
    },
    {
      title: "Loan Details",
      icon: CreditCard,
      href: "/dashbaord/loans",
      number: "3",
    },
    {
      title: "Miscellaneous",
      icon: FileText,
      href: "/dashbaord/miscellaneous",
      number: "4",
    },
    {
      title: "Events",
      icon: Calendar,
      href: "/dashbaord/events",
      number: "5",
    },
    {
      title: "Monthly Statements",
      icon: FileSpreadsheet,
      href: "/dashbaord/statements",
      number: "6",
    },
    {
      title: "Settings",
      icon: Settings,
      href: "/dashbaord/settings",
      number: "7",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">KULU Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.name || user?.email}
          {user?.role === "ADMIN" && (
            <span className="ml-2 px-2 py-1 text-xs bg-primary text-primary-foreground rounded">
              Admin
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="hover:bg-accent transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {item.number}) {item.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{item.title}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}

        <Card className="hover:bg-accent transition-colors cursor-pointer border-dashed">
          <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium text-center text-muted-foreground">
              Quick Action
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
