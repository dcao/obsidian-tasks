import { Plugin } from 'obsidian';

import { Cache } from './Cache';
import { Commands } from './Commands';
import { Events } from './Events';
import { initializeFile } from './File';
import { InlineRenderer } from './InlineRenderer';
import { QueryRenderer } from './QueryRenderer';
import { getSettings, updateSettings } from './Settings';
import { SettingsTab } from './SettingsTab';

import { VIEW_TYPE_AGENDA, AgendaView } from 'AgendaView';

export default class TasksPlugin extends Plugin {
    private cache: Cache | undefined;
    private agendaView: AgendaView | undefined;

    async onload() {
        console.log('loading plugin "tasks"');

        await this.loadSettings();
        this.addSettingTab(new SettingsTab({ plugin: this }));

        initializeFile({
            metadataCache: this.app.metadataCache,
            vault: this.app.vault,
        });

        const events = new Events({ obsidianEents: this.app.workspace });
        this.cache = new Cache({
            metadataCache: this.app.metadataCache,
            vault: this.app.vault,
            events,
        });

        new InlineRenderer({ plugin: this });
        new QueryRenderer({ plugin: this, events });
        new Commands({ plugin: this });

        this.registerView(VIEW_TYPE_AGENDA, (leaf) => (this.agendaView = new AgendaView(leaf, events)));
    }

    onunload() {
        console.log('unloading plugin "tasks"');
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
