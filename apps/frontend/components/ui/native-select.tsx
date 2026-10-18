import * as React from "react"

import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

function NativeSelect({
  className,
  children,
  placeholder,
  ...props
}: React.ComponentProps<"select"> & { placeholder?: string }) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex h-9 w-full appearance-none rounded-md border bg-transparent px-3 py-1 pr-8 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled hidden={!props.required ? undefined : true}>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export { NativeSelect }
