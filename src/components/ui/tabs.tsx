import { cva } from "class-variance-authority"
import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextValue {
  activeValue: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue>({
  activeValue: "",
  onValueChange: () => {},
})

function Tabs({
  className,
  orientation = "horizontal",
  value,
  defaultValue = "",
  onValueChange,
  children,
  ...props
}: {
  className?: string
  orientation?: "horizontal" | "vertical"
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
} & React.ComponentProps<"div">) {
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const activeValue = value !== undefined ? value : internalValue
  const handleChange = React.useCallback(
    (val: string) => {
      setInternalValue(val)
      onValueChange?.(val)
    },
    [onValueChange]
  )

  return (
    <TabsContext.Provider value={{ activeValue, onValueChange: handleChange }}>
      <div
        data-slot="tabs"
        data-orientation={orientation}
        className={cn("group/tabs flex gap-2 data-[orientation=horizontal]:flex-col", className)}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  )
}

const tabsListVariants = cva(
  "inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-10 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col bg-muted",
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
} & React.ComponentProps<"div">) {
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
  onClick,
  ...props
}: {
  value: string
  className?: string
  children: React.ReactNode
} & React.ComponentProps<"button">) {
  const { activeValue, onValueChange } = React.useContext(TabsContext)
  const isActive = activeValue === triggerValue

  return (
    <button
      type="button"
      data-slot="tabs-trigger"
      data-state={isActive ? "active" : "inactive"}
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium whitespace-nowrap text-foreground/70 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 cursor-pointer",
        "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:data-[state=active]:border-input dark:data-[state=active]:bg-card dark:data-[state=active]:text-foreground",
        className
      )}
      onClick={(e) => {
        onClick?.(e)
        onValueChange(triggerValue)
      }}
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
  ...props
}: {
  value: string
  className?: string
  children: React.ReactNode
} & React.ComponentProps<"div">) {
  const { activeValue } = React.useContext(TabsContext)

  if (activeValue !== contentValue) return null

  return (
    <div
      data-slot="tabs-content"
      className={cn("min-w-0 flex-1 text-sm outline-none pt-2", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
