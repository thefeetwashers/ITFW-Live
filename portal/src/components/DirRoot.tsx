// DirRoot — client wrapper that sets dir="rtl" on its own element when
// the user's stored language is Arabic (full-stack expert sweep,
// Nov 28, 2026). For server-rendered pages (e.g. /journey) that cannot
// read localStorage themselves. No restyle: it only sets the dir
// attribute; layout and colours are unchanged.
"use client";

import type { ReactNode } from "react";
import { usePreferredDir } from "@/lib/usePreferredDir";

export default function DirRoot({ children }: { children: ReactNode }) {
  const dir = usePreferredDir();
  return <div dir={dir}>{children}</div>;
}
