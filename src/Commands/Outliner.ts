import type { App, Editor, MarkdownView, } from 'obsidian';
import { cursorLineEnd } from '@codemirror/commands';

const headerRegex = /^#+ /gm;
const newlineRegex = /\n\n+$/g;

const getBlock = (text: string, coff: number): { level: number, blockStart: number, blockEnd: number } => {
    // Slice our text into two parts: before the cursor and after the cursor
    const before = text.slice(0, coff);
    const after = text.slice(coff);

    // Regex search before to get the current level
    let level = 1;
    let blockStart = 0;
    const results = [...before.matchAll(headerRegex)];

    if (results.length > 0) {
        const res = results[results.length - 1];
        level = res[0].length - 1;
        blockStart = res.index!;
    }

    // Regex search after to get end of block
    const sibRegex = new RegExp(`^${'#'.repeat(level)} `, "gm");

    const match = sibRegex.exec(after);
    const delta = match ? match.index - 1 : after.length;

    // Exclusive end
    const blockEnd = coff + delta;

    return { level, blockStart, blockEnd }
}

export const addSibling = (isTodo: boolean) => {

    return (editor: Editor, view: MarkdownView) => {
        view.app.workspace.trigger("obsidian-outliner:indent-list");

        // We are certain we are in the editor due to the check above.
        const path = view.file?.path;
        if (path === undefined) {
            return;
        }

        // Get the text in the editor
        const text = editor.getValue();

        // Then, move the cursor to the end of the line and
        // get its position there
        cursorLineEnd(editor.cm);
        const cur = editor.getCursor();
        const coff = editor.posToOffset(cur);

        const { level, blockStart, blockEnd } = getBlock(text, coff);

        // Preserve only one newline at the end of the block
        const blockText = text.slice(blockStart, blockEnd);
        blockText.replace(newlineRegex, "\n\n");

        // A few cases:
        const newHead = `${'#'.repeat(level)}${isTodo ? " TODO" : ""} `;
        if (blockStart == 0 && blockEnd == 0) {
            // In an empty file, just insert newHead
            editor.replaceSelection(newHead);
        } else if (blockText.endsWith("\n\n")) {
            // If the block ends with two newlines, just replace the range with
            // blockText + the new heading
            const final = `${blockText}\n${newHead}`;
            editor.setSelection(editor.offsetToPos(blockStart), editor.offsetToPos(blockEnd));
            editor.replaceSelection(final);
        } else {
            // Otherwise, just add the newHead after the block
            editor.setCursor(editor.offsetToPos(blockEnd));
            editor.replaceSelection(`\n${newHead}`);
        }
    };
};

export const indentHeadOrList = () => {
    // Check if we're at a headline.
    // If we're at a headline, just add a #
    // If we're not, defer to obsidian-outliner
};