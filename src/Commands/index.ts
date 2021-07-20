import { toggleDone } from './ToggleDone';
import { showAgenda } from './ShowAgenda';
import type { Plugin } from 'obsidian';

export class Commands {
    constructor({ plugin }: { plugin: Plugin }) {
        plugin.addCommand({
            id: 'toggle-done',
            name: 'Toggle task done',
            editorCheckCallback: toggleDone,
        });

        plugin.addCommand({
            id: 'show-agenda',
            name: 'Show agenda',
            callback: () => showAgenda(plugin.app.workspace),
        });
    }
}
