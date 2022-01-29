import { toggleDone } from './ToggleDone';
import { showAgenda } from './ShowAgenda';
import type { Plugin } from 'obsidian';
import { addSibling } from './Outliner';

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

        plugin.addCommand({
            id: 'add-sibling',
            name: 'Add sibling headline',
            editorCallback: addSibling(false),
        });

        plugin.addCommand({
            id: 'add-todo-sibling',
            name: 'Add TODO sibling headline',
            editorCallback: addSibling(true),
        });
    }
}
