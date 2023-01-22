import type { Moment } from "moment";
import {
    App,
    Editor,
    EditorPosition,
    EditorSuggest,
    EditorSuggestContext,
    EditorSuggestTriggerInfo,
    MarkdownView,
    TFile,
} from "obsidian";

import Sherlock from 'sherlockjs';
import { Task } from "Task";

interface IDateCompletion {
    start: Moment | null;
    end: Moment | null;
    isAllDay: boolean | null;
    label: string;
}

export default class DateSuggest extends EditorSuggest<IDateCompletion> {
    private app: App;

    constructor(app: App) {
        super(app);
        this.app = app;

        // // @ts-ignore
        // this.scope.register(["Shift"], "Enter", (evt: KeyboardEvent) => {
        //   // @ts-ignore
        //   this.suggestions.useSelectedItem(evt);
        //   return false;
        // });

        // if (this.plugin.settings.autosuggestToggleLink) {
        //   this.setInstructions([{ command: "Shift", purpose: "Keep text as alias" }]);
        // }
    }

    getSuggestions(context: EditorSuggestContext): IDateCompletion[] {
        const res = Sherlock.parse(context.query.substring(1));

        if (res.startDate) {
            let label = context.query[0];
            let start = window.moment(res.startDate);
            let end = null;

            if (res.isAllDay) {
                // All day event. Just format date.
                label += start.format(Task.dateFormat);

                if (res.endDate) {
                    end = window.moment(res.endDate);
                    label += "--";
                    label += end.format(Task.dateFormat);
                }
            } else {
                // Not an all day event. Full time formatting time!
                label += start.format(Task.dateTimeFormat);

                if (res.endDate) {
                    end = window.moment(res.endDate);
                    label += "--"
                    if (start.isSame(end, "day")) {
                        label += end.format(Task.timeFormat);
                    } else {
                        label += end.format(Task.dateTimeFormat);
                    }
                }
            }

            return [{ label, start, end, isAllDay: res.isAllDay }];
        }

        // catch-all if there are no matches
        return [{ label: context.query, start: null, end: null, isAllDay: null }];
    }

    renderSuggestion(suggestion: IDateCompletion, el: HTMLElement): void {
        if (suggestion.start) {
            const d = el.createDiv();
            const now = window.moment(new Date());

            let startFmt = "ddd, MMM D";
            let endFmt = "ddd, MMM D";

            if (!suggestion.start.isSame(now, "year")) {
                startFmt += ", YYYY";
            }

            if (!suggestion.end?.isSame(now, "year")) {
                endFmt += ", YYYY";
            }

            if (!suggestion.isAllDay) {
                startFmt += ", h:mma";
                endFmt += ", h:mma";
            }

            const text = suggestion.end ? `${suggestion.start.format(startFmt)} – ${suggestion.end.format(endFmt)}` : `${suggestion.start.format(startFmt)}`;

            d.setText(text);
            const d2 = el.createDiv();
            d2.setText(suggestion.label);
        } else {
            el.setText(suggestion.label)
        }
    }

    selectSuggestion(suggestion: IDateCompletion, event: KeyboardEvent | MouseEvent): void {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            return;
        }

        activeView.editor.replaceRange(suggestion.label, this.context!.start, this.context!.end);
    }

    onTrigger(
        cursor: EditorPosition,
        editor: Editor,
        file: TFile
    ): EditorSuggestTriggerInfo | null {
        const startPos = this.context?.start || {
            line: cursor.line,
            ch: cursor.ch - 1,
        };

        const text = editor.getRange(startPos, cursor);
        const char = text[0];

        if (char !== "@" && char !== "!") {
            return null;
        }

        if (text[1] == " ") {
            return null;
        }

        // If we're already looking at a valid date/time, give up
        if (text.match(Task.schedDateRegex) || text.match(Task.dueDateRegex)) {
            return null;
        }

        const precedingChar = editor.getRange(
            {
                line: startPos.line,
                ch: startPos.ch - 1,
            },
            startPos
        );

        if (precedingChar && /[`a-zA-Z0-9\[\]]/.test(precedingChar)) {
            return null;
        }

        return {
            start: startPos,
            end: cursor,
            query: editor.getRange(startPos, cursor),
        };
    }
}