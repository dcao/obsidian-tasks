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
        sourcePath: string;
    }): Promise<HTMLLIElement> {
        const li: HTMLLIElement = parentUlElement.createEl('li');
        li.addClasses(['task-list-item', 'plugin-tasks-list-item']);

        let taskAsString = this.toPlainString();
        const { globalFilter, removeGlobalFilter } = getSettings();
        if (removeGlobalFilter) {
            taskAsString = taskAsString.replace(globalFilter, '').trim();
        }

        await MarkdownRenderer.renderMarkdown(
            " " + taskAsString,
            li,
            this.path,
            null as unknown as Component,
        );

        // Unwrap the p-tag that was created by the MarkdownRenderer:
        const pElement = li.querySelector('p');
        if (pElement !== null) {
            while (pElement.firstChild) {
                li.insertBefore(pElement.firstChild, pElement);
            }
            pElement.remove();
        }

        // Remove an empty trailing p-tag that the MarkdownRenderer appends when there is a block link:
        li.findAll('p').forEach((pElement) => {
            if (!pElement.hasChildNodes()) {
                pElement.remove();
            }
        });

        const checkbox = li.createEl('input');
        checkbox.addClass('task-list-item-checkbox');
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

        li.prepend(checkbox);

        // post info
        li.createEl("br");

        const now = window.moment(Date.now());

        // First, examine deadline time
        if (this.dueStart) {
            const due = li.createSpan();
            let style = "font-size: 0.75em;margin-right: 1em;";
            let text = "d. ";
            // Check if this is due today.
            if (this.dueStart.isSame(now, "day")) {
                // In this case, we report time.
                style += "color: var(--text-error);"

                // If there's a stop period, we interpret 12am start.
                // Otherwise, it's just due today generically.
                if (this.dueStop) {
                    text += this.dueStart.format("h:mma");
                    text += "–";
                    text += this.dueStop.format("h:mma");
                } else {
                    text += "0d";
                }
            } else {
                let nowd = now.startOf("day");
                let stad = this.dueStart.startOf("day");
                let diff = stad.diff(nowd, "days");
                text += `${diff}d`;
                if (diff < 0) {
                    style += "color: var(--text-error);";
                } else {
                    style += "color: var(--text-muted);";
                }
            }
            due.textContent = text;
            due.setAttribute("style", style);
        }

        // Next, examine scheduled time
        if (this.schedStart) {
            const sched = li.createSpan();
            let style = "font-size: 0.75em;margin-right:1em;";
            let text = "s. ";
            // Check if this is due today.
            if (this.schedStart.isSame(now, "day")) {
                // In this case, we report time.
                style += "color: var(--orange);"

                // If there's a stop period, we interpret 12am start.
                // Otherwise, it's just sched today generically.
                if (this.schedStop) {
                    text += this.schedStart.format("h:mma");
                    text += "–";
                    text += this.schedStop.format("h:mma");
                } else {
                    text += "0d";
                }
            } else {
                let nowd = now.startOf("day");
                let stad = this.schedStart.startOf("day");
                let diff = stad.diff(nowd, "days");
                text += `${diff}d`;
                if (diff < 0) {
                    style += "color: var(--orange);";
                } else {
                    style += "color: var(--text-muted);";
                }
            }
            sched.textContent = text;
            sched.setAttribute("style", style);
        }

        // Examine recurrence
        if (this.recurrence) {
            const recur = li.createSpan();
            let style = "font-size: 0.75em; margin-right: 1em; color: var(--text-muted)";
            let text = this.recurrence.toText();

            recur.textContent = `+${text}`;
            recur.setAttribute("style", style);
        }

        // Finally, the section. Only add if the source path differs from this path.
        if (sourcePath) {
            const sec = li.createSpan();
            sec.setAttribute("style", "font-size: 0.75em; color: var(--text-muted);");

            let fileName: string | undefined;
            const fileNameMatch = this.path.match(/([^/]+)\.md$/);
            if (fileNameMatch !== null) {
                fileName = fileNameMatch[1];
            }

            if (fileName !== undefined) {
                sec.append('(');
                const link = sec.createEl('a');
                link.href = fileName;
                link.setAttribute('data-href', fileName);
                link.rel = 'noopener';
                link.target = '_blank';
                link.addClass('internal-link');

                let linkText = fileName;
                if (this.precedingHeader !== null) {
                    link.href = link.href + '#' + this.precedingHeader;
                    link.setAttribute(
                        'data-href',
                        link.getAttribute('data-href') +
                            '#' +
                            this.precedingHeader,
                    );

                    // Otherwise, this wouldn't provide additinoal information and only take up space.
                    if (this.precedingHeader !== fileName) {
                        linkText = linkText + ' > ' + this.precedingHeader;
                    }
                }

                link.setText(linkText);
                sec.append(')');
            }
        }


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
