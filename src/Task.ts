import { Component, MarkdownRenderer } from 'obsidian';

import { replaceTaskWithTasks } from './File';
import { getSettings } from './Settings';
import type { Moment } from 'moment';
import { Recurrence } from './Recurrence';

export enum Status {
    Todo = 'Todo',
    Done = 'Done',
}

export class Task {
    public readonly status: Status;
    public readonly description: string;
    public readonly path: string;
    public readonly indentation: string;
    /** Line number where the section starts that contains this task. */
    public readonly sectionStart: number;
    /** The index of the nth task in its section. */
    public readonly sectionIndex: number;
    /**
     * The original character from within `[]` in the document.
     * Required to be added to the LI the same way obsidian does as a `data-task` attribute.
     */
    public readonly originalStatusCharacter: string;
    public readonly precedingHeader: string | null;

    public readonly dueStart: Moment | null;
    public readonly dueStop: Moment | null;

    public readonly schedStart: Moment | null;
    public readonly schedStop: Moment | null;

    public readonly doneDate: Moment | null;

    public readonly recurrence: Recurrence | null;

    /** The blockLink is a "^" annotation after the dates/recurrence rules. */
    public readonly blockLink: string;

    public static readonly timeFormat = 'HH:mm';
    public static readonly dateFormat = 'YYYY-MM-DD';
    public static readonly dateTimeFormat = 'YYYY-MM-DDTHH:mm';

    public static readonly taskRegex = /^([\s\t]*)[-*] +\[(.)\] *(.*)/u;
    // The following regexes end with `$` because they will be matched and
    // removed from the end until none are left.
    public static readonly dueDateRegex = /!\{?(\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?)(--((\d{4}-\d{2}-\d{2})|(\d{2}:\d{2})|(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})))?\}?$/u;
    public static readonly schedDateRegex = /@\{?(\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?)(--((\d{4}-\d{2}-\d{2})|(\d{2}:\d{2})|(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})))?\}?$/u;
    public static readonly doneDateRegex = /✅ ?(\d{4}-\d{2}-\d{2})$/u;
    public static readonly recurrenceRegex = /\+([a-zA-Z0-9, !]+)$/u;
    public static readonly blockLinkRegex = / \^[a-zA-Z0-9-]+$/u;

    constructor({
        status,
        description,
        path,
        indentation,
        sectionStart,
        sectionIndex,
        originalStatusCharacter,
        precedingHeader,
        schedStart,
        schedStop,
        dueStart,
        dueStop,
        doneDate,
        recurrence,
        blockLink,
    }: {
        status: Status;
        description: string;
        path: string;
        indentation: string;
        sectionStart: number;
        sectionIndex: number;
        originalStatusCharacter: string;
        precedingHeader: string | null;
        schedStart: moment.Moment | null;
        schedStop: moment.Moment | null;
        dueStart: moment.Moment | null;
        dueStop: moment.Moment | null;
        doneDate: moment.Moment | null;
        recurrence: Recurrence | null;
        blockLink: string;
    }) {
        this.status = status;
        this.description = description;
        this.path = path;
        this.indentation = indentation;
        this.sectionStart = sectionStart;
        this.sectionIndex = sectionIndex;
        this.originalStatusCharacter = originalStatusCharacter;
        this.precedingHeader = precedingHeader;
        this.schedStart = schedStart;
        this.schedStop = schedStop;
        this.dueStart = dueStart;
        this.dueStop = dueStop;
        this.doneDate = doneDate;
        this.recurrence = recurrence;
        this.blockLink = blockLink;
    }

    public static fromLine({
        line,
        path,
        sectionStart,
        sectionIndex,
        precedingHeader,
    }: {
        line: string;
        path: string;
        sectionStart: number;
        sectionIndex: number;
        precedingHeader: string | null;
    }): Task | null {
        const regexMatch = line.match(Task.taskRegex);
        if (regexMatch === null) {
            return null;
        }

        const indentation = regexMatch[1];
        const statusString = regexMatch[2].toLowerCase();

        let status: Status;
        switch (statusString) {
            case ' ':
                status = Status.Todo;
                break;
            default:
                status = Status.Done;
        }

        // match[3] includes the whole body of the task after the brackets.
        const body = regexMatch[3].trim();

        const { globalFilter } = getSettings();
        if (!body.includes(globalFilter)) {
            return null;
        }

        let description = body;

        const blockLinkMatch = description.match(this.blockLinkRegex);
        const blockLink = blockLinkMatch !== null ? blockLinkMatch[0] : '';

        if (blockLink !== '') {
            description = description.replace(this.blockLinkRegex, '').trim();
        }

        // Keep matching and removing special strings from the end of the
        // description in any order. The loop should only run once if the
        // strings are in the expected order after the description.
        let matched: boolean;

        var schedStart: Moment | null = null;
        var schedStop: Moment | null = null;
        var dueStart: Moment | null = null;
        var dueStop: Moment | null = null;

        let doneDate: Moment | null = null;
        let recurrence: Recurrence | null = null;
        // Add a "max runs" failsafe to never end in an endless loop:
        const maxRuns = 6;
        let runs = 0;
        do {
            matched = false;
            const doneDateMatch = description.match(Task.doneDateRegex);
            if (doneDateMatch !== null) {
                doneDate = window.moment(doneDateMatch[1], Task.dateFormat);
                description = description
                    .replace(Task.doneDateRegex, '')
                    .trim();
                matched = true;
            }
            
            const schedDateMatch = description.match(Task.schedDateRegex);
            if (schedDateMatch !== null) {
                // sched date start
                if (schedDateMatch[2]) {
                    schedStart = window.moment(schedDateMatch[1], Task.dateTimeFormat);
                } else {
                    schedStart = window.moment(schedDateMatch[1], Task.dateFormat);
                }

                // sched date stop
                if (schedDateMatch[3]) {
                    // we have an end sched date!
                    // there are three cases:
                    if (schedDateMatch[5]) {
                        // just date
                        schedStop = window.moment(schedDateMatch[5], Task.dateFormat);
                    } else if (schedDateMatch[6]) {
                        // just time
                        schedStop = window.moment(schedDateMatch[6], Task.timeFormat);
                        schedStop.set({
                            year: schedStart.get('year'),
                            month: schedStart.get('month'),
                            date: schedStart.get('date')
                        });
                    } else {
                        // both date and time
                        schedStop = window.moment(schedDateMatch[7], Task.dateTimeFormat);
                    }
                }

                description = description.replace(Task.schedDateRegex, '').trim();
                matched = true;
            }

            const dueDateMatch = description.match(Task.dueDateRegex);
            if (dueDateMatch !== null) {
                // due date start
                if (dueDateMatch[2]) {
                    dueStart = window.moment(dueDateMatch[1], Task.dateTimeFormat);
                } else {
                    dueStart = window.moment(dueDateMatch[1], Task.dateFormat);
                }

                // due date stop
                if (dueDateMatch[3]) {
                    // we have an end due date!
                    // there are three cases:
                    if (dueDateMatch[5]) {
                        // just date
                        dueStop = window.moment(dueDateMatch[5], Task.dateFormat);
                    } else if (dueDateMatch[6]) {
                        // just time
                        dueStop = window.moment(dueDateMatch[6], Task.timeFormat);
                        dueStop.set({
                            year: dueStart.get('year'),
                            month: dueStart.get('month'),
                            date: dueStart.get('date')
                        });
                    } else {
                        // both date and time
                        dueStop = window.moment(dueDateMatch[7], Task.dateTimeFormat);
                    }
                }

                description = description.replace(Task.dueDateRegex, '').trim();
                matched = true;
            }

            const recurrenceMatch = description.match(Task.recurrenceRegex);
            if (recurrenceMatch !== null) {
                recurrence = Recurrence.fromText({
                    recurrenceRuleText: recurrenceMatch[1].trim(),
                    schedStart,
                    schedStop,
                    dueStart,
                    dueStop,
                });

                description = description
                    .replace(Task.recurrenceRegex, '')
                    .trim();
                matched = true;
            }

            runs++;
        } while (matched && runs <= maxRuns);

        const task = new Task({
            status,
            description,
            path,
            indentation,
            sectionStart,
            sectionIndex,
            originalStatusCharacter: statusString,
            precedingHeader,
            schedStart,
            schedStop,
            dueStart,
            dueStop,
            doneDate,
            recurrence,
            blockLink,
        });

        return task;
    }

    public async toLi({
        parentUlElement,
        listIndex,
        sourcePath,
    }: {
        parentUlElement: HTMLElement;
        /** The nth item in this list (including non-tasks). */
        listIndex: number;
        sourcePath: string | null;
    }): Promise<HTMLLIElement> {
        const li: HTMLLIElement = parentUlElement.createEl('li');
        li.addClasses(['task-list-item', 'plugin-tasks-list-item']);

        let taskAsString = this.toPlainString();
        const { globalFilter, removeGlobalFilter } = getSettings();
        if (removeGlobalFilter) {
            taskAsString = taskAsString.replace(globalFilter, '').trim();
        }

        let outer = li.createEl("div");
        outer.setAttribute("style", "display: flex; align-items: baseline;");

        let wrapper = outer.createEl("div");
        wrapper.setAttribute("style", "flex-grow: 1; display: flex; align-items: center; flex-wrap: wrap;");

        let content = wrapper.createSpan();
        content.setAttribute("style", "flex-grow: 1;");

        await MarkdownRenderer.renderMarkdown(
            taskAsString,
            content,
            this.path,
            null as unknown as Component,
        );

        // Unwrap the p-tag that was created by the MarkdownRenderer:
        const pElement = content.querySelector('p');
        if (pElement !== null) {
            while (pElement.firstChild) {
                content.insertBefore(pElement.firstChild, pElement);
            }
            pElement.remove();
        }

        // Remove an empty trailing p-tag that the MarkdownRenderer appends when there is a block link:
        content.findAll('p').forEach((pElement) => {
            if (!pElement.hasChildNodes()) {
                pElement.remove();
            }
        });

        const now = window.moment(Date.now());

        let cookies = wrapper.createEl("div");
        cookies.setAttribute("style", "margin-left: auto;");

        // Examine recurrence
        if (this.recurrence) {
            const recur = cookies.createSpan();
            let style = "font-size: 0.75em; margin-right: 0.5em; color: var(--text-muted)";
            let text = this.recurrence.toText();

            recur.textContent = `+${text}`;
            recur.setAttribute("style", style);
        }

        // The section. Only add if the source path differs from this path.
        if (sourcePath) {
            const sec = cookies.createSpan();
            sec.setAttribute("style", "font-size: 0.85em; background-color: var(--background-primary-alt); padding: 3px; margin-left: 2px; white-space: nowrap; margin-right: 0.5em;");

            let fileName: string | undefined;
            const fileNameMatch = this.path.match(/([^/]+)\.md$/);
            if (fileNameMatch !== null) {
                fileName = fileNameMatch[1];
            }

            if (fileName !== undefined) {
                const link = sec.createEl('a');
                link.href = this.path;
                link.setAttribute('data-href', this.path);
                link.rel = 'noopener';
                link.target = '_blank';
                link.addClass('internal-link');

                let dendronName = (path: string) => path.split(".").last()!;
                // let linkText = fileName;
                let linkText;
                // special-casing daily notes. janky but idc
                if ("d" === this.path.substring(0, this.path.lastIndexOf("/"))) {
                    linkText = "(daily)";
                } else {
                    linkText = dendronName(fileName);
                }

                if (this.precedingHeader !== null) {
                    link.href = link.href + '#' + this.precedingHeader;
                    link.setAttribute(
                        'data-href',
                        link.getAttribute('data-href') +
                            '#' +
                            this.precedingHeader,
                    );

                    // Otherwise, this wouldn't provide additinoal information and only take up space.
                    // if (this.precedingHeader !== fileName) {
                    //     linkText = linkText + ' > ' + this.precedingHeader;
                    // }
                }

                link.setText(linkText);
            }
        }

        // Next, examine scheduled time
        if (this.schedStart) {
            const sched = content.createSpan();
            let style = "margin-right: 0.5em; white-space: nowrap; background-color: var(--background-primary-alt); padding: 0 4px; border: 1px solid var(--background-modifier-hover); font-size: 0.9em;";
            let text = "";
            // Check if this is due today.
            if (this.schedStart.isSame(now, "day")) {
                if (this.status == Status.Todo) {
                    style += "color: var(--text-normal); border: 1px solid var(--background-modifier-border-hover)"
                } else {
                    style += "color: var(--text-muted);"
                }

                // If there's a stop period, we interpret 12am start.
                // Otherwise, it's just sched today generically.
                if (this.schedStop) {
                    text += this.schedStart.format("h:mma");
                    text += "–";
                    text += this.schedStop.format("h:mma");
                } else if (this.schedStart.format("h:mma") != "12:00am") {
                    text += this.schedStart.format("h:mma");
                } else {
                    text += "0d";
                }
            } else {
                let nowd = now.startOf("day");
                let stad = this.schedStart.clone().startOf("day");
                let diff = stad.diff(nowd, "days");
                text += `${diff}d`;
                if (diff < 0 && this.status == Status.Todo) {
                    style += "color: var(--color-orange); border: 1px solid var(--color-orange);"
                } else {
                    style += "color: var(--text-muted);"
                }

                // If there's a stop period, we interpret 12am start.
                // Otherwise, it's just sched today generically.
                if (this.schedStop) {
                    text += " ";
                    text += this.schedStart.format("h:mma");
                    text += "–";
                    text += this.schedStop.format("h:mma");
                } else if (this.schedStart.format("h:mma") != "12:00am") {
                    text += " ";
                    text += this.schedStart.format("h:mma");
                }
            }
            sched.textContent = text;
            sched.setAttribute("style", style);
            content.prepend(sched);
        }

        // examine deadline time
        if (this.dueStart) {
            const due = content.createSpan();
            let style = "margin-right: 0.5em; white-space: nowrap; background-color: var(--background-modifier-error); padding: 0 4px; border: 1px solid var(--background-modifier-hover); font-size: 0.9em;";
            let text = "";
            // Check if this is due today.
            if (this.dueStart.isSame(now, "day")) {
                if (this.status == Status.Todo) {
                    style += "border: 1px solid var(--color-red); color: var(--color-red);"
                } else {
                    style += "color: var(--text-muted);"
                }

                // If there's a stop period, we interpret 12am start.
                // Otherwise, it's just due today generically.
                if (this.dueStop) {
                    text += this.dueStart.format("h:mma");
                    text += "–";
                    text += this.dueStop.format("h:mma");
                } else if (this.dueStart.format("h:mma") != "12:00am") {
                    text += this.dueStart.format("h:mma");
                } else {
                    text += "0d";
                }
            } else {
                let nowd = now.startOf("day");
                let stad = this.dueStart.clone().startOf("day");
                let diff = stad.diff(nowd, "days");
                text += `${diff}d`;
                if (diff < 0 && this.status == Status.Todo) {
                    style += "border: 1px solid var(--color-red); color: var(--color-red);"
                } else {
                    style += "color: var(--text-muted);"
                }

                // If there's a stop period, we interpret 12am start.
                // Otherwise, it's just due today generically.
                if (this.dueStop) {
                    text += " ";
                    text += this.dueStart.format("h:mma");
                    text += "–";
                    text += this.dueStop.format("h:mma");
                } else if (this.dueStart.format("h:mma") != "12:00am") {
                    text += " ";
                    text += this.dueStart.format("h:mma");
                }
            }
            due.textContent = text;
            due.setAttribute("style", style);

            content.prepend(due);
        }

        const checkbox = outer.createEl('input');
        checkbox.addClass('task-list-item-checkbox');
        checkbox.setAttribute("style", "margin-right: 0.6em; top: 0.1em;");
        checkbox.type = 'checkbox';
        if (this.status !== Status.Todo) {
            checkbox.checked = true;
            li.addClass('is-checked');
        }
        checkbox.onClickEvent((event: MouseEvent) => {
            event.preventDefault();
            // It is required to stop propagation so that obsidian won't write the file with the
            // checkbox (un)checked. Obsidian would write after us and overwrite our change.
            event.stopPropagation();

            // Should be re-rendered as enabled after update in file.
            checkbox.disabled = true;
            const toggledTasks = this.toggle();
            replaceTaskWithTasks({
                originalTask: this,
                newTasks: toggledTasks,
            });
        });

        outer.prepend(checkbox);

        // Set these to be compatible with stock obsidian lists:
        li.setAttr('data-task', this.originalStatusCharacter.trim()); // Trim to ensure empty attribute for space. Same way as obsidian.
        li.setAttr('data-line', listIndex);
        checkbox.setAttr('data-line', listIndex);


        return li;
    }

    public toString(): string {
        const schedStart: string = this.schedStart
            ? this.schedStart.get('hour') === 0 && this.schedStart.get('minute') === 0
                ? ` @${this.schedStart.format(Task.dateFormat)}`
                : ` @${this.schedStart.format(Task.dateTimeFormat)}`
            : '';
        const schedStop: string = this.schedStart && this.schedStop
            ? this.schedStart.format(Task.dateFormat) === this.schedStop.format(Task.dateFormat)
                ? `--${this.schedStop.format(Task.timeFormat)}`
                : this.schedStop.get('hour') === 0 && this.schedStop.get('minute') === 0
                    ? `--${this.schedStop.format(Task.dateFormat)}`
                    : `--${this.schedStop.format(Task.dateTimeFormat)}`
            : '';
        const dueStart: string = this.dueStart
            ? this.dueStart.get('hour') === 0 && this.dueStart.get('minute') === 0
                ? ` !${this.dueStart.format(Task.dateFormat)}`
                : ` !${this.dueStart.format(Task.dateTimeFormat)}`
            : '';
        const dueStop: string = this.dueStart && this.dueStop
            ? this.dueStart.format(Task.dateFormat) === this.dueStop.format(Task.dateFormat)
                ? `--${this.dueStop.format(Task.timeFormat)}`
                : this.dueStop.get('hour') === 0 && this.dueStop.get('minute') === 0
                    ? `--${this.dueStop.format(Task.dateFormat)}`
                    : `--${this.dueStop.format(Task.dateTimeFormat)}`
            : '';
        const recurrenceRule: string = this.recurrence
            ? ` +${this.recurrence.toText()}`
            : '';
        const doneDate: string = this.doneDate
            ? ` ✅ ${this.doneDate.format(Task.dateFormat)}`
            : '';

        return `${this.description}${recurrenceRule}${schedStart}${schedStop}${dueStart}${dueStop}${doneDate}${this.blockLink}`;
    }

    public toPlainString(): string {
        return `${this.description}`;
    }

    public toFileLineString(): string {
        return `${this.indentation}- [${
            this.originalStatusCharacter
        }] ${this.toString()}`;
    }

    /**
     * Toggles this task and returns the resulting tasks.
     *
     * Toggling can result in more than one returned task in the case of
     * recurrence. If it is a recurring task, the toggled task will be returned
     * toether with the next occurrence in the order `[next, toggled]`. If the
     * task is not recurring, it will return `[toggled]`.
     */
    public toggle(): Task[] {
        const newStatus: Status =
            this.status === Status.Todo ? Status.Done : Status.Todo;
        let newDoneDate = null;
        let nextOccurrence: {
            schedStart: Moment | null;
            schedStop: Moment | null;
            dueStart: Moment | null;
            dueStop: Moment | null;
        } | null = null;
        if (newStatus !== Status.Todo) {
            newDoneDate = window.moment();

            // If this task is no longer todo, we need to check if it is recurring:
            if (this.recurrence !== null) {
                nextOccurrence = this.recurrence.next();
            }
        }

        const toggledTask = new Task({
            ...this,
            status: newStatus,
            doneDate: newDoneDate,
            originalStatusCharacter: newStatus === Status.Done ? 'x' : ' ',
        });

        const newTasks: Task[] = [];

        if (nextOccurrence !== null) {
            const nextTask = new Task({
                ...this,
                ...nextOccurrence,
                // New occurrences cannot have the same block link.
                // And random block links don't help.
                blockLink: '',
            });
            newTasks.push(nextTask);
        }

        // Write next occurrence before previous occurrence.
        newTasks.push(toggledTask);

        return newTasks;
    }
}
