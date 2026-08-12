import {
  Children,
  cloneElement,
  createContext,
  createElement,
  forwardRef,
  isValidElement,
  useContext,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import {
  Dialog as DialogPrimitive,
  DropdownMenu as DropdownMenuPrimitive,
  Progress as ProgressPrimitive,
  Slider as SliderPrimitive,
  Tabs as TabsPrimitive,
  ToggleGroup as ToggleGroupPrimitive,
  Tooltip as TooltipPrimitive,
} from "radix-ui";
import { cn } from "../../lib/cn";

type Sx = Record<string, string | number | undefined>;

function sxStyle(sx?: Sx): CSSProperties | undefined {
  if (!sx) return undefined;
  const style: Record<string, string | number> = {};
  const spacing = (value: string | number) =>
    typeof value === "number" ? `${value * 0.5}rem` : value;
  for (const [key, value] of Object.entries(sx)) {
    if (value === undefined) continue;
    if (key === "gap") style.gap = spacing(value);
    else if (key === "mb") style.marginBottom = spacing(value);
    else if (key === "pt") style.paddingTop = spacing(value);
    else style[key] = value;
  }
  return style as CSSProperties;
}

type BoxProps = Omit<HTMLAttributes<HTMLElement>, "onChange"> & {
  component?: ElementType;
  src?: string;
  alt?: string;
  type?: "button" | "submit" | "reset";
  htmlFor?: string;
  value?: string | number;
  disabled?: boolean;
  square?: boolean;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  sx?: Sx;
};

export const Box = forwardRef<HTMLElement, BoxProps>(function Box(
  { component: Component = "div", className, sx, style, ...props },
  ref,
) {
  return createElement(Component, {
    ...props,
    ref,
    className,
    style: { ...sxStyle(sx), ...style },
  });
});

type TypographyVariant =
  | "h1"
  | "h2"
  | "h3"
  | "subtitle1"
  | "subtitle2"
  | "body1"
  | "body2"
  | "caption"
  | "overline";

type TypographyProps = HTMLAttributes<HTMLElement> & {
  component?: ElementType;
  variant?: TypographyVariant;
  color?: string;
  sx?: Sx;
};

const typographyElements: Record<TypographyVariant, ElementType> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  subtitle1: "p",
  subtitle2: "p",
  body1: "p",
  body2: "p",
  caption: "span",
  overline: "span",
};

const typographyClasses: Record<TypographyVariant, string> = {
  h1: "ui-typography-h1",
  h2: "ui-typography-h2",
  h3: "ui-typography-h3",
  subtitle1: "ui-typography-subtitle1",
  subtitle2: "ui-typography-subtitle2",
  body1: "ui-typography-body1",
  body2: "ui-typography-body2",
  caption: "ui-typography-caption",
  overline: "ui-typography-overline",
};

export function Typography({
  component,
  variant = "body1",
  color,
  className,
  sx,
  style,
  ...props
}: TypographyProps) {
  return createElement(component ?? typographyElements[variant], {
    ...props,
    className: cn(
      "ui-typography",
      typographyClasses[variant],
      color === "text.secondary" && "text-muted",
      className,
    ),
    style: { ...sxStyle(sx), ...style },
  });
}

const buttonVariants = cva(
  "ui-button inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        contained: "ui-button-contained",
        outlined: "ui-button-outlined",
        text: "ui-button-text",
      },
      intent: {
        default: "",
        primary: "ui-button-primary",
        success: "ui-button-success",
        warning: "ui-button-warning",
        error: "ui-button-error",
        inherit: "",
      },
      size: {
        small: "min-h-11 px-3 text-xs",
        medium: "min-h-11",
        large: "min-h-12 px-5",
      },
    },
    defaultVariants: {
      variant: "text",
      intent: "default",
      size: "medium",
    },
  },
);

type ButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "color"
> &
  VariantProps<typeof buttonVariants> & {
    component?: ElementType;
    to?: string;
    href?: string;
    startIcon?: ReactNode;
    endIcon?: ReactNode;
    color?: "primary" | "success" | "warning" | "error" | "inherit";
    sx?: Sx;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      component: Component = "button",
      className,
      variant,
      size,
      color,
      startIcon,
      endIcon,
      children,
      sx,
      style,
      type,
      ...props
    },
    ref,
  ) {
    return createElement(
      Component,
      {
        ...props,
        ref,
        type: Component === "button" ? (type ?? "button") : type,
        className: cn(
          buttonVariants({ variant, intent: color ?? "default", size }),
          className,
        ),
        style: { ...sxStyle(sx), ...style },
      },
      startIcon && <span className="ui-button-icon">{startIcon}</span>,
      children,
      endIcon && <span className="ui-button-icon">{endIcon}</span>,
    );
  },
);

export const IconButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function IconButton({ className, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "ui-icon-button inline-flex size-11 shrink-0 items-center justify-center rounded-md transition disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});

type PaperProps = BoxProps & { elevation?: number };

export const Paper = forwardRef<HTMLElement, PaperProps>(function Paper(
  { className, elevation: _elevation, square: _square, ...props },
  ref,
) {
  return <Box ref={ref} className={cn("ui-card", className)} {...props} />;
});

export const Card = Paper;

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  severity?: "success" | "info" | "warning" | "error";
  action?: ReactNode;
  onClose?: () => void;
  sx?: Sx;
};

const alertSeverityClasses: Record<
  NonNullable<AlertProps["severity"]>,
  string
> = {
  success: "ui-alert-success",
  info: "ui-alert-info",
  warning: "ui-alert-warning",
  error: "ui-alert-error",
};

export function Alert({
  severity = "info",
  action,
  onClose,
  className,
  children,
  sx,
  style,
  ...props
}: AlertProps) {
  return (
    <div
      className={cn("ui-alert", alertSeverityClasses[severity], className)}
      style={{ ...sxStyle(sx), ...style }}
      {...props}
    >
      <div className="ui-alert-content">{children}</div>
      {action}
      {onClose && (
        <IconButton aria-label="Cerrar aviso" onClick={onClose}>
          <X aria-hidden="true" />
        </IconButton>
      )}
    </div>
  );
}

type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  label: ReactNode;
  icon?: ReactNode;
  color?: "primary" | "success" | "warning" | "error" | "default";
  size?: "small" | "medium";
};

const badgeColorClasses: Record<NonNullable<ChipProps["color"]>, string> = {
  primary: "ui-badge-primary",
  success: "ui-badge-success",
  warning: "ui-badge-warning",
  error: "ui-badge-error",
  default: "ui-badge-default",
};

export function Chip({
  label,
  icon,
  color = "default",
  size = "medium",
  className,
  ...props
}: ChipProps) {
  return (
    <span
      className={cn(
        "ui-badge",
        badgeColorClasses[color],
        size === "small" && "ui-badge-small",
        className,
      )}
      {...props}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}

export const Badge = Chip;

export function CircularProgress({
  size = 28,
  className,
  color: _color,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  size?: number;
  color?: string;
}) {
  return (
    <span
      className={cn("ui-spinner", className)}
      style={{ width: size, height: size }}
      role={props["aria-label"] ? "status" : undefined}
      {...props}
    />
  );
}

export const Spinner = CircularProgress;

type StackProps = BoxProps & {
  direction?: "row" | "column";
  spacing?: number;
};

export const Stack = forwardRef<HTMLElement, StackProps>(function Stack(
  { direction = "column", spacing, className, sx, style, ...props },
  ref,
) {
  return (
    <Box
      ref={ref}
      className={cn(
        "ui-stack",
        direction === "row" ? "flex-row" : "flex-col",
        className,
      )}
      style={{
        gap: spacing === undefined ? undefined : `${spacing * 0.5}rem`,
        ...sxStyle(sx),
        ...style,
      }}
      {...props}
    />
  );
});

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: string;
  helperText?: ReactNode;
  error?: boolean;
  slotProps?: { htmlInput?: InputHTMLAttributes<HTMLInputElement> };
  size?: "small" | "medium";
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    {
      label,
      helperText,
      error,
      slotProps,
      className,
      id,
      required,
      size: _size,
      ...props
    },
    ref,
  ) {
    const fieldId =
      id ??
      `field-${(label ?? "input").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const helperId = helperText ? `${fieldId}-helper` : undefined;
    return (
      <label className={cn("ui-field", error && "ui-field-error", className)}>
        {label && (
          <span className="ui-field-label">
            {label}
            {required && <span aria-hidden="true"> *</span>}
          </span>
        )}
        <input
          {...props}
          {...slotProps?.htmlInput}
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={error || undefined}
          aria-describedby={helperId}
          className="ui-input"
        />
        {helperText && (
          <span id={helperId} className="ui-field-helper">
            {helperText}
          </span>
        )}
      </label>
    );
  },
);

export const Input = TextField;
export const Field = TextField;

export function FormControl({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-form-control", className)} {...props} />;
}

export function FormLabel({
  className,
  htmlFor,
  ...props
}: HTMLAttributes<HTMLLabelElement> & { htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("ui-form-label", className)}
      {...props}
    />
  );
}

type SliderProps = Omit<
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
  "value" | "onValueChange" | "onChange" | "min" | "max" | "step"
> & {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange?: (event: Event, value: number) => void;
  size?: "small" | "medium";
};

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  onChange,
  className,
  ...props
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      value={[value]}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={([next]) => onChange?.(new Event("change"), next ?? value)}
      className={cn("ui-slider", className)}
      {...props}
    >
      <SliderPrimitive.Track className="ui-slider-track">
        <SliderPrimitive.Range className="ui-slider-range" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="ui-slider-thumb" />
    </SliderPrimitive.Root>
  );
}

type ToggleButtonGroupProps<T extends string | number> = {
  value: T;
  onChange?: (event: Event, value: T) => void;
  exclusive?: boolean;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
};

export function ToggleButtonGroup<T extends string | number>({
  value,
  onChange,
  exclusive: _exclusive,
  fullWidth,
  className,
  children,
}: ToggleButtonGroupProps<T>) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={String(value)}
      onValueChange={(next) => {
        if (!next) return;
        const normalized = (
          typeof value === "number" ? Number(next) : next
        ) as T;
        onChange?.(new Event("change"), normalized);
      }}
      className={cn("ui-toggle-group", fullWidth && "w-full", className)}
    >
      {children}
    </ToggleGroupPrimitive.Root>
  );
}

export function ToggleButton({
  value,
  className,
  ...props
}: Omit<
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>,
  "value"
> & {
  value: string | number;
}) {
  return (
    <ToggleGroupPrimitive.Item
      value={String(value)}
      className={cn("ui-toggle-button", className)}
      {...props}
    />
  );
}

export const ToggleGroup = ToggleButtonGroup;

type TabProps = Omit<
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
  "value" | "children"
> & {
  value?: string | number;
  label: ReactNode;
  icon?: ReactNode;
  iconPosition?: "start" | "end";
};

export function Tab({
  value,
  label,
  icon,
  iconPosition = "start",
  className,
  ...props
}: TabProps) {
  return (
    <TabsPrimitive.Trigger
      value={String(value ?? "")}
      className={cn("ui-tab", className)}
      {...props}
    >
      {icon && iconPosition === "start" && icon}
      {label}
      {icon && iconPosition === "end" && icon}
    </TabsPrimitive.Trigger>
  );
}

type TabsProps<T extends string | number> = {
  value: T;
  onChange?: (event: Event, value: T) => void;
  variant?: "fullWidth" | "scrollable" | "standard";
  scrollButtons?: "auto" | boolean;
  className?: string;
  children?: ReactNode;
  "aria-label"?: string;
};

export function Tabs<T extends string | number>({
  value,
  onChange,
  variant,
  scrollButtons: _scrollButtons,
  className,
  children,
  ...props
}: TabsProps<T>) {
  const normalized = Children.map(children, (child, index) => {
    if (!isValidElement(child)) return child;
    const tab = child as ReactElement<TabProps>;
    return cloneElement(tab, { value: tab.props.value ?? index });
  });
  return (
    <TabsPrimitive.Root
      value={String(value)}
      onValueChange={(next) =>
        onChange?.(
          new Event("change"),
          (typeof value === "number" ? Number(next) : next) as T,
        )
      }
      className={cn("ui-tabs", className)}
      {...props}
    >
      <TabsPrimitive.List
        className={cn(
          "ui-tab-list",
          variant === "fullWidth" && "ui-tab-list-full",
        )}
      >
        {normalized}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}

type DialogProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  fullWidth?: boolean;
  maxWidth?: string;
};

export function Dialog({ open, onClose, children }: DialogProps) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);

  useLayoutEffect(() => {
    if (open && !wasOpen.current) {
      returnFocus.current = document.activeElement as HTMLElement | null;
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => !next && onClose()}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-dialog-overlay" />
        <DialogPrimitive.Content
          className="ui-dialog-content"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          {children}
          <DialogPrimitive.Close asChild>
            <IconButton
              className="ui-dialog-close"
              aria-label="Cerrar diÃ¡logo"
            >
              <X aria-hidden="true" />
            </IconButton>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function DialogTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <DialogPrimitive.Title
      className={cn("ui-dialog-title", className)}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-dialog-body", className)} {...props} />;
}

export function DialogActions({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-dialog-actions", className)} {...props} />;
}

export function Tooltip({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactElement;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={450}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content sideOffset={7} className="ui-tooltip">
            {title}
            <TooltipPrimitive.Arrow className="ui-tooltip-arrow" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export const DropdownMenu = DropdownMenuPrimitive;

export function ButtonGroup({
  className,
  size: _size,
  ...props
}: HTMLAttributes<HTMLDivElement> & { size?: string }) {
  return <div className={cn("ui-button-group", className)} {...props} />;
}

export function Divider({ children }: { children?: ReactNode }) {
  return (
    <div className="ui-divider" role="separator">
      <span />
      {children && <em>{children}</em>}
      <span />
    </div>
  );
}

export function LinearProgress({
  value,
  className,
  variant: _variant,
  ...props
}: HTMLAttributes<HTMLDivElement> & { value: number; variant?: string }) {
  return (
    <ProgressPrimitive.Root
      value={value}
      className={cn("ui-progress", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="ui-progress-indicator"
        style={{ transform: `translateX(-${100 - value}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export const Table = ({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) => (
  <table className={cn("ui-table", className)} {...props} />
);
const TableHeadContext = createContext(false);
export const TableHead = (
  props: React.HTMLAttributes<HTMLTableSectionElement>,
) => (
  <TableHeadContext.Provider value>
    <thead {...props} />
  </TableHeadContext.Provider>
);
export const TableBody = (
  props: React.HTMLAttributes<HTMLTableSectionElement>,
) => <tbody {...props} />;
export const TableRow = (props: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr {...props} />
);
export function TableCell({
  align,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  const heading = useContext(TableHeadContext);
  const Component = heading ? "th" : "td";
  return (
    <Component
      scope={heading ? "col" : undefined}
      className={cn(align === "right" && "text-right", className)}
      {...props}
    />
  );
}
