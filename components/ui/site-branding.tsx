"use client";

export function SiteBranding({
  size = "md",
  collapsed = false,
}: {
  size?: "sm" | "md" | "lg";
  collapsed?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="font-bold text-lg">PAARI SHG</div>
      {!collapsed && (
        <span className="text-sm text-muted-foreground">Financial System</span>
      )}
    </div>
  );
}
