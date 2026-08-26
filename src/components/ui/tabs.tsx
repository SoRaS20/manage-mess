import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  value,
  onValueChange,
  children,
  ...props
}: {
  className?: string
  orientation?: "horizontal" | "vertical"
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}) {
  const [internalValue, setInternalValue] = React.useState("")
  const activeValue = value ?? internalValue
  const handleChange = onValueChange ?? setInternalValue

  return (
    <div
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-2 data-[orientation=horizontal]:flex-col", className)}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            _activeValue: activeValue,
            _onValueChange: handleChange,
          })
        }
        return child
      })}
    </div>
  )
}

const tabsListVariants = cva(
  "inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-8 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: {
  className?: string
  variant?: "default" | "line"
  children: React.ReactNode
}) {
  return (
    <div
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {children}
    </div>
  )
}

function TabsTrigger({
  value: triggerValue,
  className,
  children,
  _activeValue,
  _onValueChange,
  ...props
}: {
  value: string
  className?: string
  children: React.ReactNode
  _activeValue?: string
  _onValueChange?: (value: string) => void
} & React.ComponentProps<"button">) {
  const isActive = _activeValue === triggerValue

  return (
    <button
      data-slot="tabs-trigger"
      data-state={isActive ? "active" : "inactive"}
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground",
        className
      )}
      onClick={() => _onValueChange?.(triggerValue)}
      {...props}
    >
      {children}
    </button>
  )
}

function TabsContent({
  value: contentValue,
  className,
  children,
  _activeValue,
  ...props
}: {
  value: string
  className?: string
  children: React.ReactNode
  _activeValue?: string
} & React.ComponentProps<"div">) {
  if (_activeValue !== contentValue) return null

  return (
    <div
      data-slot="tabs-content"
      className={cn("min-w-0 flex-1 text-sm outline-none", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
