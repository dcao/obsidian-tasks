import { ItemView, WorkspaceLeaf } from 'obsidian';
import Agenda from './ui/Agenda.svelte';
import type { Events } from 'Events';

export const VIEW_TYPE_AGENDA = "agenda";

export class AgendaView extends ItemView {
    private agenda: Agenda | undefined;
    private events: Events;

    constructor(leaf: WorkspaceLeaf, events: Events) {
        super(leaf);

        this.events = events;
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
            },
        });
    }
}