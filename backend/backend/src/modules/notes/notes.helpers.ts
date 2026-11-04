import type { MatterNote } from "./notes.types.js";

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export function createNote(input: {
  author: string;
  role?: string;
  content: string;
  isInternal?: boolean;
}): MatterNote {
  return {
    id: `N-${Date.now()}`,
    author: input.author,
    role: input.role ?? "Solicitor",
    date: asTimestampString(new Date()),
    content: input.content.trim(),
    isInternal: input.isInternal ?? true,
  };
}
