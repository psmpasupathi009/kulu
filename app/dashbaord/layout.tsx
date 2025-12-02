import { AppSidebar } from "@/components/home/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { PageHeader } from "@/components/home/page-header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <PageHeader />
          <div className="flex-1 p-4">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
