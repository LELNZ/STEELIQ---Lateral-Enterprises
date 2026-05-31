---
name: Badge inside Radix asChild triggers
description: Why wrapping shadcn Badge directly in TooltipTrigger/PopoverTrigger asChild throws a ref warning, and the fix
---

The shadcn `Badge` (`client/src/components/ui/badge.tsx`) is a plain function component that does NOT use `forwardRef`. Radix `*Trigger asChild` (and any `Slot`) clones its child and passes a ref, so making a `Badge` the direct `asChild` child logs a React "function components cannot be given refs" warning at runtime (it still works, but the warning is noise).

**Fix:** wrap the Badge in a native ref-accepting element and put `asChild` on that wrapper instead:
```jsx
<TooltipTrigger asChild>
  <span className="inline-flex max-w-full" tabIndex={0}>
    <Badge ...>…</Badge>
  </span>
</TooltipTrigger>
```
The `span` is a host element so it accepts the ref/props cleanly; `tabIndex={0}` keeps the trigger keyboard-focusable.

**Why:** caught when adding responsive collapsing tooltip badges to the LL builder header — the warning only surfaced in browser console during runtime testing, not in `npm run check`/`build`.

**How to apply:** any time you wrap `Badge` (or another non-forwardRef component here) in a Radix `asChild` trigger, interpose a `span`/`div` wrapper. Same applies to `PopoverTrigger asChild`.
