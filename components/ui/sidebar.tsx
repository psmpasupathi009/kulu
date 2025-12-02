"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { PanelLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

const SidebarContext = React.createContext<{
  state: "expanded" | "collapsed"
  setState: (state: "expanded" | "collapsed") => void
  isMobile: boolean
}>({
  state: "expanded",
  setState: () => {},
  isMobile: false,
})

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<"expanded" | "collapsed">("expanded")
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  return (
    <SidebarContext.Provider value={{ state, setState, isMobile }}>
      <div className="flex w-full">
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider")
  }
  return context
}

export function Sidebar({ children, collapsible, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { collapsible?: "icon" | "offcanvas" }) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <aside
      className={cn(
        "flex h-screen w-64 flex-col border-r bg-background transition-all",
        isCollapsed && "w-16",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  )
}

export function SidebarHeader({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex h-16 items-center border-b px-4", className)} {...props}>
      {children}
    </div>
  )
}

export function SidebarContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex-1 overflow-y-auto p-4", className)} {...props}>
      {children}
    </div>
  )
}

export function SidebarFooter({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("border-t p-4", className)} {...props}>
      {children}
    </div>
  )
}

export function SidebarRail({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("hidden", className)} {...props} />
}

export function SidebarTrigger({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setState, state } = useSidebar()
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setState(state === "expanded" ? "collapsed" : "expanded")}
      {...props}
    >
      <PanelLeft className="h-5 w-5" />
    </Button>
  )
}

export function SidebarGroup({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {children}
    </div>
  )
}

export function SidebarGroupLabel({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-2 py-1 text-xs font-semibold text-muted-foreground", className)} {...props}>
      {children}
    </div>
  )
}

export function SidebarMenu({ children, className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul className={cn("space-y-1", className)} {...props}>
      {children}
    </ul>
  )
}

export function SidebarMenuItem({ children, className, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return (
    <li className={className} {...props}>
      {children}
    </li>
  )
}

export function SidebarMenuButton({ children, className, tooltip, size = "default", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tooltip?: string; size?: "default" | "lg" }) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
        size === "lg" && "px-4 py-3",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function SidebarMenuSub({ children, className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul className={cn("ml-4 space-y-1", className)} {...props}>
      {children}
    </ul>
  )
}

export function SidebarMenuSubItem({ children, className, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return (
    <li className={className} {...props}>
      {children}
    </li>
  )
}

export function SidebarMenuSubButton({ children, className, asChild, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  if (asChild) {
    return <>{children}</>
  }
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function SidebarMenuAction({ children, className, showOnHover, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { showOnHover?: boolean }) {
  return (
    <button
      className={cn(
        "ml-auto rounded-md p-1 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100",
        showOnHover && "opacity-100",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

