import { Component, MarkdownRenderer } from 'obsidian';
import { RRule } from 'rrule';

import { replaceTaskWithTasks } from './File';
import { getSettings } from './Settings';
import type { Moment } from 'moment';

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
    public readonly doneDate: Moment | null;
    public readonly recurrenceRule: RRule | null;
    /** The blockLink is a "^" annotation after the dates/recurrence rules. */
    public readonly blockLink: string;

    public static readonly timeFormat = 'HH:mm';
    public static readonly dateFormat = 'YYYY-MM-DD';
    public static readonly dateTimeFormat = 'YYYY-MM-DDTHH:mm';

    public static readonly taskRegex = /^([\s\t]*)[-*] +\[(.)\] *(.*)/u;
    // The following regexes end with `$` because they will be matched and
    // removed from the end until none are left.
    // public static readonly dueDateRegex = /!(\d{4}-\d{2}-\d{2})$/u;
    public static readonly dueDateRegex = /!\{?(\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?)(--((\d{4}-\d{2}-\d{2})|(\d{2}:\d{2})|(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})))?\}?$/u;
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
        dueStart,
        dueStop,
        doneDate,
        recurrenceRule,
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
        dueStart: moment.Moment | null;
        dueStop: moment.Moment | null;
        doneDate: moment.Moment | null;
        recurrenceRule: RRule | null;
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
        this.dueStart = dueStart;
        this.dueStop = dueStop;
        this.doneDate = doneDate;
        this.recurrenceRule = recurrenceRule;
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
        let dueStart: Moment | null = null;
        let dueStop: Moment | null = null;
        let doneDate: Moment | null = null;
        let recurrenceRule: RRule | null = null;
        // Add a "max runs" failsafe to never end in an endless loop:
        const maxRuns = 4;
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
                try {
                    recurrenceRule = RRule.fromText(recurrenceMatch[1].trim());
                } catch (error) {
                    // Could not read recurrence rule. User possibly not done typing.
                }

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
            dueStart,
            dueStop,
            doneDate,
            recurrenceRule,
            blockLink,
        });

        return task;
    }

    public async toLi({
        parentUlElement,
        listIndex,
    }: {
        parentUlElement: HTMLElement;
        /** The nth item in this list (including non-tasks). */
        listIndex: number;
    }): Promise<HTMLLIElement> {
        const li: HTMLLIElement = parentUlElement.createEl('li');
        li.addClasses(['task-list-item', 'plugin-tasks-list-item']);

        let taskAsString = this.toString();
        const { globalFilter, removeGlobalFilter } = getSettings();
        if (removeGlobalFilter) {
            taskAsString = taskAsString.replace(globalFilter, '').trim();
        }

        await MarkdownRenderer.renderMarkdown(
            taskAsString,
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

        // Set these to be compatible with stock obsidian lists:
        li.setAttr('data-task', this.originalStatusCharacter.trim()); // Trim to ensure empty attribute for space. Same way as obsidian.
        li.setAttr('data-line', listIndex);
        checkbox.setAttr('data-line', listIndex);

        return li;
    }

    public toString(): string {
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
        const recurrenceRule: string = this.recurrenceRule
            ? ` +${this.recurrenceRule.toText()}`
            : '';
        const doneDate: string = this.doneDate
            ? ` ✅ ${this.doneDate.format(Task.dateFormat)}`
            : '';

        return `${this.description}${dueStart}${dueStop}${recurrenceRule}${doneDate}${this.blockLink}`;
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
        let nextStart: Moment | undefined;
        let nextStop: Moment | null | undefined = null;
        if (newStatus !== Status.Todo) {
            newDoneDate = window.moment();

            // If this task is no longer todo, we need to check if it is recurring:
            if (this.recurrenceRule !== null) {
                // If no due date, next occurrence is after "today".
                const dtStart: Moment =
                    this.dueStart !== null ? this.dueStart.clone() : window.moment().startOf('day');

                // RRule disregards the timezone:
                // dtStart.utc(true);

                // Create a new rrule with `dtstart` set so that the date of
                // the new occurrence is calculated based on the original due
                // date and not based on today.
                const rrule = new RRule({
                    ...this.recurrenceRule.options,
                    byhour: null,
                    byminute: null,
                    bysecond: null,
                    dtstart: dtStart.toDate(),
                });

                // The next occurrence should happen after today (with the same time
                // as the start time) or the due date, whatever is later.
                const today = window.moment().utc(true);
                today.set({
                    hour: dtStart.get("hour"),
                    minute: dtStart.get("minute"),
                    second: dtStart.get("second"),
                });
                const after = today.isAfter(dtStart) ? today : dtStart;
                const next = rrule.after(after.toDate(), false);

                if (next !== null) {
                    // Re-add the timezone that RRule disregarded:
                    nextStart = window.moment(next);
                    nextStop = this.dueStop?.clone();
                    nextStop?.add(nextStart.diff(this.dueStart));
                }
            }
        }

        const toggledTask = new Task({
            ...this,
            status: newStatus,
            doneDate: newDoneDate,
            originalStatusCharacter: newStatus === Status.Done ? 'x' : ' ',
        });

        const newTasks: Task[] = [];

        if (nextStart !== undefined) {
            const nextTask = new Task({
                ...this,
                dueStart: nextStart,
                dueStop: nextStop,
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
