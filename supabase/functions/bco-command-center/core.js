export const SEARCH_FIELDS = Object.freeze({
  contacts: ["name", "email", "phone", "address"],
  leads: ["note", "source", "status"],
  opportunities: ["title", "stage", "source", "notes"],
  tasks: ["title", "status", "priority"]
});
export const SUMMARY_FILTERS = Object.freeze({
  leads: { column: "status", excluded: ["won", "lost", "closed"] },
  opportunities: { column: "stage", excluded: ["won", "lost", "closed"] },
  tasks: { column: "status", excluded: ["done", "completed", "cancelled"] },
  jobs: { column: "status", excluded: ["completed", "done", "cancelled"] },
  quotes: { column: "status", excluded: ["cancelled", "void"] }
});
export function searchOr(fields, term) {
  const value = "%" + String(term || "").trim().replace(/[%_,]/g, " ") + "%";
  return fields.map((field) => field + ".ilike." + value).join(",");
}
export function activeFilter(table) {
  const item = SUMMARY_FILTERS[table];
  if (!item) throw new Error("UNKNOWN_SUMMARY_TABLE");
  return { column: item.column, values: "(" + item.excluded.join(",") + ")" };
}
