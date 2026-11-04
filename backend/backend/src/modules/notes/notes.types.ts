export interface MatterNote {
  id: string;
  author: string;
  role: string;
  date: string;
  content: string;
  isInternal: boolean;
}

export interface MatterNotesThread {
  matterId: string;
  notes: MatterNote[];
}
