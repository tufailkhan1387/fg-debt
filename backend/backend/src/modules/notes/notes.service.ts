import { mattersService } from "../matters/matters.service.js";
import { createNote } from "./notes.helpers.js";
import type { MatterFull } from "../matters/matters.types.js";
import type { MatterNote, MatterNotesThread } from "./notes.types.js";

function sortNotes(notes: MatterNote[]): MatterNote[] {
  return [...notes].sort((a, b) => b.date.localeCompare(a.date));
}

export const notesService = {
  async listForMatter(solicitorEmail: string, matterId: string): Promise<MatterNotesThread> {
    const matter = await mattersService.getByIdForSolicitor(solicitorEmail, matterId);
    return {
      matterId: matter.id,
      notes: sortNotes(matter.notes as MatterNote[]),
    };
  },

  async addForMatter(
    solicitorEmail: string,
    matterId: string,
    solicitorName: string,
    content: string,
    isInternal = true,
  ): Promise<{ note: MatterNote; matter: MatterFull }> {
    await mattersService.getByIdForSolicitor(solicitorEmail, matterId);
    const note = createNote({
      author: solicitorName,
      content,
      isInternal,
    });
    const matter = await mattersService.addNote(matterId, note, solicitorName);
    return { note, matter };
  },
};
