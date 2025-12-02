"use client";

import * as React from "react";
import { Home, FolderDot } from "lucide-react";

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

import { Users, PiggyBank, CreditCard, FileText, Calendar, FileSpreadsheet, Settings, UserCog } from "lucide-react"

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashbaord",
      icon: Home,
      items: [],
    },
    {
      title: "Users",
      url: "/dashbaord/users",
      icon: UserCog,
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
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link href="/" className="flex items-center gap-2 px-4 py-3">
          <SiteBranding size="md" collapsed={isCollapsed} />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <ThemeToggle />
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
