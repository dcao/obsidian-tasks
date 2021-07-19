import { toggleDone } from './ToggleDone';
import type { Plugin } from 'obsidian';

export class Commands {
    constructor({ plugin }: { plugin: Plugin }) {
        plugin.addCommand({
            id: 'toggle-done',
            name: 'Toggle task done',
            editorCheckCallback: toggleDone,
        });
    }
}
