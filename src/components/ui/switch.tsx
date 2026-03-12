"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-40",
        // checked: accent 컬러
        "data-[state=checked]:border-transparent",
        // unchecked: 뚜렷한 테두리 + 배경
        "data-[state=unchecked]:border-[var(--border-color)]",
        "data-[state=unchecked]:bg-[rgba(255,255,255,0.1)]",
        className
      )}
      style={{
        backgroundColor: props.checked ? "var(--accent-color)" : undefined,
      }}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full shadow-md transition-transform",
          "data-[state=checked]:translate-x-5",
          "data-[state=unchecked]:translate-x-0",
          // checked: 어두운 썸
          "data-[state=checked]:bg-[var(--bg-primary)]",
          // unchecked: 밝은 썸
          "data-[state=unchecked]:bg-[var(--text-muted)]",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
