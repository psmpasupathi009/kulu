"use client";

import * as React from "react";
import { Home } from "lucide-react";

import { NavMain } from "@/components/home/nav-main";
import { NavUser } from "@/components/home/nav-user";
import { SiteBranding } from "@/components/ui/site-branding";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";

import {
  Users,
  PiggyBank,
  CreditCard,
  FileText,
  Calendar,
  FileSpreadsheet,
  Settings,
  RotateCcw,
  Building2,
  User,
} from "lucide-react";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { user } = useAuth();

  // Base menu items available to all authenticated users
  const baseMenuItems = [
    {
      title: "Dashboard",
      url: "/dashbaord",
      icon: Home,
      items: [],
    },
    {
      title: "My Profile",
      url: "/dashbaord/profile",
      icon: User,
      items: [],
    },
    {
      title: "Member Details",
      url: "/dashbaord/members",
      icon: Users,
      items: [],
    },
    {
      title: "Savings",
      url: "/dashbaord/savings",
      icon: PiggyBank,
      items: [],
    },
    {
      title: "Loan Details",
      url: "/dashbaord/loans",
      icon: CreditCard,
      items: [],
    },
    {
      title: "Loan Cycles",
      url: "/dashbaord/cycles",
      icon: RotateCcw,
      items: [],
    },
    {
      title: "ROSCA Groups",
      url: "/dashbaord/groups",
      icon: Building2,
      items: [],
    },
    {
      title: "Miscellaneous",
      url: "/dashbaord/miscellaneous",
      icon: FileText,
      items: [],
    },
    {
      title: "Events",
      url: "/dashbaord/events",
      icon: Calendar,
      items: [],
    },
    {
      title: "Monthly Statements",
      url: "/dashbaord/statements",
      icon: FileSpreadsheet,
      items: [],
    },
    {
      title: "Settings",
      url: "/dashbaord/settings",
      icon: Settings,
      items: [],
    },
  ];

  // All menu items are available to all authenticated users
  // Members are users, so user management is done through member management
  const navMain = baseMenuItems;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 px-4 py-3">
          <SiteBranding size="md" collapsed={isCollapsed} />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <ThemeToggle />
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
