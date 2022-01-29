import { EventRef, Plugin } from 'obsidian';

import { Cache } from './Cache';
import { Commands } from './Commands';
import { Events } from './Events';
import { initializeFile } from './File';
import { InlineRenderer } from './InlineRenderer';
import { QueryRenderer } from './QueryRenderer';
import { getSettings, updateSettings } from './Settings';
import { SettingsTab } from './SettingsTab';

import { VIEW_TYPE_AGENDA, AgendaView } from 'AgendaView';
import type { Task } from 'Task';
import type { Moment } from 'moment';

export default class TasksPlugin extends Plugin {
    private cache: Cache | undefined;
    private agendaView: AgendaView | undefined;
    private events: Events;
    private fileWatcher: EventRef;

    async onload() {
        console.log('loading plugin "tasks"');

        await this.loadSettings();
        this.addSettingTab(new SettingsTab({ plugin: this }));

        initializeFile({
            metadataCache: this.app.metadataCache,
            vault: this.app.vault,
        });

        this.events = new Events({ obsidianEents: this.app.workspace });
        this.cache = new Cache({
            metadataCache: this.app.metadataCache,
            vault: this.app.vault,
            events: this.events,
        });

        new InlineRenderer({ plugin: this });
        new QueryRenderer({ plugin: this, events: this.events });
        new Commands({ plugin: this });

        this.registerView(VIEW_TYPE_AGENDA, (leaf) => (this.agendaView = new AgendaView(leaf, this.events, this.cache!.getTasks())));
        this.initFileListener();

        if (this.app.workspace.layoutReady) {
            this.initLeaf();
        } else {
            this.registerEvent(
                this.app.workspace.on("layout-ready", this.initLeaf.bind(this))
            );
        }
    }

    initLeaf(): void {
        if (this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENDA).length) {
            return;
        }
        this.app.workspace.getRightLeaf(false).setViewState({
            type: VIEW_TYPE_AGENDA,
        });
    }

    // Initializes writing to agenda.json
    // TODO: is this performant? i have no idea lol
    initFileListener(): void {
        this.fileWatcher = this.events.onCacheUpdate((data) => {
            const now = window.moment(Date.now());

            const withinWeek = (d: Moment | null) => d && Math.abs(now.diff(d, "days")) < 7;

            const tasks = data.tasks.filter(t => withinWeek(t.schedStart) || withinWeek(t.dueStart));

            let agenda: { [key: string]: Task[]; } = {};
            
            for (let dayDelta = 0; dayDelta < 7; dayDelta++) {
                const date = now.clone();
                date.add(dayDelta, "days");

                let res: Task[] = [];
                for (let t of tasks) {
                    if ((t.schedStart && date.isSame(t.schedStart, "day")) || (t.dueStart && date.isSame(t.dueStart, "day"))) {
                        res.push(t);
                    }
                }

                agenda[date.format("YYYY-MM-DD")] = res;
            }

            this.app.vault.adapter.write(".agenda.json", JSON.stringify(agenda));
        });
    }

    onunload() {
        console.log('unloading plugin "tasks"');
        this.events.off(this.fileWatcher);
        this.cache?.unload();
        this.app.workspace
            .getLeavesOfType(VIEW_TYPE_AGENDA)
            .forEach((leaf) => leaf.detach());
    }

    async loadSettings() {
        const newSettings = await this.loadData();
        updateSettings(newSettings);
    }

    async saveSettings() {
        await this.saveData(getSettings());
    }
}
