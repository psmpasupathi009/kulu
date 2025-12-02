"use client"

import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"

export function ThemeToggle() {
  // Simplified theme toggle - can be enhanced later
  return (
    <Button variant="ghost" size="icon">
      <Sun className="h-5 w-5" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

