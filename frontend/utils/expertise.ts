/** Normalize expertise from API (TEXT[] or string). */
export function formatExpertiseForDisplay(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (typeof item !== "string") return [];
        const trimmed = item.trim();
        if (!trimmed || trimmed === "{}") return [];
        return [trimmed];
      })
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim() && value.trim() !== "{}") {
    return value
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** Join expertise array for textarea editing. */
export function formatExpertiseForEdit(value: unknown): string {
  const items = formatExpertiseForDisplay(value);
  return items.join(", ");
}
