"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

export function PageHeader() {
  const pathname = usePathname();
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((seg) => decodeURIComponent(seg));

  const crumbs = segments.map((seg, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const label = seg
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const isLast = idx === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <header className="flex h-14 sm:h-16 shrink-0 items-center gap-1 sm:gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 w-full min-w-0">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Separator
          orientation="vertical"
          className="mr-1 sm:mr-2 data-[orientation=vertical]:h-4 shrink-0 hidden sm:block"
        />
        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList className="flex-wrap gap-1 sm:gap-2">
            <BreadcrumbItem className="shrink-0">
              <BreadcrumbLink href="/" className="text-xs sm:text-sm">Home</BreadcrumbLink>
            </BreadcrumbItem>
            {crumbs.length > 0 && <BreadcrumbSeparator className="hidden sm:block" />}
            {crumbs.map((c, i) => (
              <Fragment key={c.href}>
                {!c.isLast ? (
                  <BreadcrumbItem key={c.href} className="shrink-0">
                    <BreadcrumbLink href={c.href} className="text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">{c.label}</BreadcrumbLink>
                  </BreadcrumbItem>
                ) : (
                  <BreadcrumbItem key={c.href} className="shrink-0 min-w-0">
                    <BreadcrumbPage className="text-xs sm:text-sm truncate max-w-[150px] sm:max-w-none">{c.label}</BreadcrumbPage>
                  </BreadcrumbItem>
                )}
                {i < crumbs.length - 1 && <BreadcrumbSeparator className="hidden sm:block" />}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
