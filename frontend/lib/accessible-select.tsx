import { useEffect } from "react";
import { Select } from "../components/ui/select";
import type { ComponentProps } from "react";
// Radix hides background from the accessibility tree while its portalled list is
// open. Also make it inert: hidden background controls must not stay focusable.
export function AccessibleSelect(props: ComponentProps<typeof Select>) {
  useEffect(
    () => () => {
      const root = document.getElementById("root");
      if (root) root.inert = false;
    },
    [],
  );
  return (
    <Select
      {...props}
      onOpenChange={(open) => {
        const root = document.getElementById("root");
        if (root) root.inert = open;
        props.onOpenChange?.(open);
      }}
    />
  );
}
