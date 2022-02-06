import { ItemView, WorkspaceLeaf } from 'obsidian';
import Agenda from './ui/Agenda.svelte';
import type { Events } from 'Events';
import type { Task } from 'Task';
import { createDailyNote, getAllDailyNotes, getDailyNote } from 'obsidian-daily-notes-interface';

export const VIEW_TYPE_AGENDA = "agenda";

export class AgendaView extends ItemView {
    private agenda: Agenda | undefined;
    private events: Events;
    private tasks: Task[];

    constructor(leaf: WorkspaceLeaf, events: Events, tasks: Task[]) {
        super(leaf);

        this.openOrCreateDailyNote = this.openOrCreateDailyNote.bind(this);
        this.openTodoFile = this.openTodoFile.bind(this);
        this.events = events;
        this.tasks = tasks;
    }

    async openOrCreateDailyNote(
        di: any,
    ): Promise<void> {
        // if we clicked on an event, don't do anything
        console.log("we openin");
        if (!(di.jsEvent.path.find((f: any) => f.className === "ec-event"))) {
            const { workspace } = this.app;
            const m = window.moment(di.date);
            var existingFile = getDailyNote(m, getAllDailyNotes());
            if (!existingFile) {
                // File doesn't exist
                existingFile = await createDailyNote(m);
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mode = (this.app.vault as any).getConfig("defaultViewMode");
            // const leaf = inNewSplit
            //     ? workspace.splitActiveLeaf()
            //     : workspace.getUnpinnedLeaf();
            const leaf = workspace.getUnpinnedLeaf();
            await leaf.openFile(existingFile, { active: true, mode });
        }
    }

    async openTodoFile(ei: any): Promise<void> {
        console.log(ei);
        if (ei.event.extendedProps.path != "") {
            const { workspace } = this.app;
            const targetFile = this.app.vault
                .getFiles()
                .find((f) => f.path === ei.event.extendedProps.path)!;

            const mode = (this.app.vault as any).getConfig("defaultViewMode");
            // const leaf = inNewSplit
            //     ? workspace.splitActiveLeaf()
            //     : workspace.getUnpinnedLeaf();
            const leaf = workspace.getUnpinnedLeaf();
            const eState = {
                line: ei.event.extendedProps.line
            }
            await leaf.openFile(targetFile, { active: true, mode, eState });
        }
    }

    getViewType(): string {
        return VIEW_TYPE_AGENDA;
    }

    getDisplayText(): string {
        return 'Agenda';
    }

    getIcon(): string {
        return "calendar-with-checkmark";
    }

    async onOpen() {
        this.agenda = new Agenda({
            target: (this as any).contentEl,
            props: {
                events: this.events,
                tasks: this.tasks,
                onClickDay: this.openOrCreateDailyNote,
                onClickEvent: this.openTodoFile,
            },
        });
    }
}