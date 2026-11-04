export function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function csvRow(values: Array<string | number>): string {
  return values.map(csvCell).join(",");
}
