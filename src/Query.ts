import chrono from 'chrono-node';
import type moment from 'moment';

import { Status, Task } from './Task';

export class Query {
    private _limit: number | undefined = undefined;
    private _filters: ((task: Task) => boolean)[] = [];
    private _error: string | undefined = undefined;

    private readonly noDueString = 'no due date';
    private readonly noScheduledString = 'no scheduled date';
    private readonly dueRegexp = /due (before|after|on)? ?(.*)/;
    private readonly schedRegexp = /scheduled (before|after|on)? ?(.*)/;
    private readonly anyRegexp = /any (before|after|on)? ?(.*)/;
    private readonly doneString = 'done';
    private readonly notDoneString = 'not done';
    private readonly doneRegexp = /done (before|after|on)? ?(.*)/;
    private readonly pathRegexp = /path (includes|does not include) (.*)/;
    private readonly descriptionRegexp =
        /description (includes|does not include) (.*)/;
    private readonly headingRegexp = /heading (includes|does not include) (.*)/;
    private readonly limitRegexp = /limit (to )?(\d+)( tasks?)?/;
    private readonly excludeSubItemsString = 'exclude sub-items';

    constructor({ source }: { source: string }) {
        source
            .split('\n')
            .map((line: string) => line.trim())
            .forEach((line: string) => {
                switch (true) {
                    case line === '':
                        break;
                    case line === this.doneString:
                        this._filters.push(
                            (task) => task.status === Status.Done,
                        );
                        break;
                    case line === this.notDoneString:
                        this._filters.push(
                            (task) => task.status !== Status.Done,
                        );
                        break;
                    case line === this.excludeSubItemsString:
                        this._filters.push((task) => task.indentation === '');
                        break;
                    case line === this.noDueString:
                        this._filters.push((task) => task.dueStart === null);
                        break;
                    case line === this.noScheduledString:
                        this._filters.push((task) => task.schedStart === null);
                        break;
                    case this.anyRegexp.test(line):
                        this.parseAnyFilter({ line });
                        break;
                    case this.schedRegexp.test(line):
                        this.parseSchedFilter({ line });
                        break;
                    case this.dueRegexp.test(line):
                        this.parseDueFilter({ line });
                        break;
                    case this.doneRegexp.test(line):
                        this.parseDoneFilter({ line });
                        break;
                    case this.pathRegexp.test(line):
                        this.parsePathFilter({ line });
                        break;
                    case this.descriptionRegexp.test(line):
                        this.parseDescriptionFilter({ line });
                        break;
                    case this.headingRegexp.test(line):
                        this.parseHeadingFilter({ line });
                        break;
                    case this.limitRegexp.test(line):
                        this.parseLimit({ line });
                        break;
                    default:
                        this._error = 'invalid query clause';
                }
            });
    }

    public get limit(): number | undefined {
        return this._limit;
    }

    public get filters(): ((task: Task) => boolean)[] {
        return this._filters;
    }

    public get error(): string | undefined {
        return this._error;
    }
    
    private parseAnyFilter({ line }: { line: string }): void {
        const anyMatch = line.match(this.anyRegexp);
        if (anyMatch !== null) {
            let filterDate: moment.Moment;
            try {
                filterDate = this.parseDate(anyMatch[2]);
                if (!filterDate.isValid()) {
                    this._error = 'invalid any date in query';
                    return;
                }
            } catch {
                this._error = 'invalid any date in query';
                return;
            }

            let filter;
            if (anyMatch[1] === 'before') {
                filter = (task: Task) => {
                    if (task.dueStart) {
                        if (task.dueStart.isBefore(filterDate)) return true;
                    }
                    
                    return task.schedStart ? task.schedStart.isBefore(filterDate) : false;
                };
            } else if (anyMatch[1] === 'after') {
                // For after queries, if the filter date's hour and min are 0,
                // check for after the end of day by setting filter date to end of day.
                const zeroHm = filterDate.get("hour") === 0 && filterDate.get("minute") === 0;
                if (zeroHm) {
                    filterDate.endOf('day');
                }

                filter = (task: Task) => {
                    if (task.dueStart) {
                        if (task.dueStart.isAfter(filterDate)) return true;
                    }
                    
                    return task.schedStart ? task.schedStart.isAfter(filterDate) : false;
                };
            } else {
                // For same queries, if the filter date's hour and min are 0,
                // check for if it's same day, not exactly the same.
                const zeroHm = filterDate.get("hour") === 0 && filterDate.get("minute") === 0;
                if (zeroHm) {
                    filter = (task: Task) => {
                        if (task.dueStart) {
                            if (task.dueStart.isSame(filterDate, 'day')) return true;
                        }
                        
                        return task.schedStart ? task.schedStart.isSame(filterDate, 'day') : false;
                    };
                } else {
                    filter = (task: Task) => {
                        if (task.dueStart) {
                            if (task.dueStart.isSame(filterDate)) return true;
                        }
                        
                        return task.schedStart ? task.schedStart.isSame(filterDate) : false;
                    };
                }
            }

            this._filters.push(filter);
        } else {
            this._error = 'invalid any date in query';
        }
    }

    private parseSchedFilter({ line }: { line: string }): void {
        const schedMatch = line.match(this.schedRegexp);
        if (schedMatch !== null) {
            let filterDate: moment.Moment;
            try {
                filterDate = this.parseDate(schedMatch[2]);
                if (!filterDate.isValid()) {
                    this._error = 'invalid sched date in query';
                    return;
                }
            } catch {
                this._error = 'invalid sched date in query';
                return;
            }

            let filter;
            if (schedMatch[1] === 'before') {
                filter = (task: Task) =>
                    task.schedStart ? task.schedStart.isBefore(filterDate) : false;
            } else if (schedMatch[1] === 'after') {
                // For after queries, if the filter date's hour and min are 0,
                // check for after the end of day by setting filter date to end of day.
                const zeroHm = filterDate.get("hour") === 0 && filterDate.get("minute") === 0;
                if (zeroHm) {
                    filterDate.endOf('day');
                }
                filter = (task: Task) =>
                    task.schedStart ? task.schedStart.isAfter(filterDate) : false;
            } else {
                // For same queries, if the filter date's hour and min are 0,
                // check for if it's same day, not exactly the same.
                const zeroHm = filterDate.get("hour") === 0 && filterDate.get("minute") === 0;
                if (zeroHm) {
                    filter = (task: Task) =>
                        task.schedStart ? task.schedStart.isSame(filterDate, 'day') : false;
                } else {
                    filter = (task: Task) =>
                        task.schedStart ? task.schedStart.isSame(filterDate) : false;
                }
            }

            this._filters.push(filter);
        } else {
            this._error = 'invalid sched date in query';
        }
    }

    private parseDueFilter({ line }: { line: string }): void {
        const dueMatch = line.match(this.dueRegexp);
        if (dueMatch !== null) {
            let filterDate: moment.Moment;
            try {
                filterDate = this.parseDate(dueMatch[2]);
                if (!filterDate.isValid()) {
                    this._error = 'invalid due date in query';
                    return;
                }
            } catch {
                this._error = 'invalid due date in query';
                return;
            }

            let filter;
            if (dueMatch[1] === 'before') {
                filter = (task: Task) =>
                    task.dueStart ? task.dueStart.isBefore(filterDate) : false;
            } else if (dueMatch[1] === 'after') {
                // For after queries, if the filter date's hour and min are 0,
                // check for after the end of day by setting filter date to end of day.
                const zeroHm = filterDate.get("hour") === 0 && filterDate.get("minute") === 0;
                if (zeroHm) {
                    filterDate.endOf('day');
                }
                filter = (task: Task) =>
                    task.dueStart ? task.dueStart.isAfter(filterDate) : false;
            } else {
                // For same queries, if the filter date's hour and min are 0,
                // check for if it's same day, not exactly the same.
                const zeroHm = filterDate.get("hour") === 0 && filterDate.get("minute") === 0;
                if (zeroHm) {
                    filter = (task: Task) =>
                        task.dueStart ? task.dueStart.isSame(filterDate, 'day') : false;
                } else {
                    filter = (task: Task) =>
                        task.dueStart ? task.dueStart.isSame(filterDate) : false;
                }
            }

            this._filters.push(filter);
        } else {
            this._error = 'invalid due date in query';
        }
    }

    private parseDoneFilter({ line }: { line: string }): void {
        const doneMatch = line.match(this.doneRegexp);
        if (doneMatch !== null) {
            let filterDate: moment.Moment;
            try {
                filterDate = this.parseDate(doneMatch[2]);
                if (!filterDate.isValid()) {
                    this._error = 'invalid done date in query';
                    return;
                }
            } catch {
                this._error = 'invalid done date in query';
                return;
            }

            let filter;
            if (doneMatch[1] === 'before') {
                filter = (task: Task) =>
                    task.doneDate ? task.doneDate.isBefore(filterDate) : false;
            } else if (doneMatch[1] === 'after') {
                filter = (task: Task) =>
                    task.doneDate ? task.doneDate.isAfter(filterDate) : false;
            } else {
                filter = (task: Task) =>
                    task.doneDate ? task.doneDate.isSame(filterDate) : false;
            }

            this._filters.push(filter);
        }
    }

    private parsePathFilter({ line }: { line: string }): void {
        const pathMatch = line.match(this.pathRegexp);
        if (pathMatch !== null) {
            const filterMethod = pathMatch[1];
            if (filterMethod === 'includes') {
                this._filters.push((task: Task) =>
                    task.path.includes(pathMatch[2]),
                );
            } else if (pathMatch[1] === 'does not include') {
                this._filters.push(
                    (task: Task) => !task.path.includes(pathMatch[2]),
                );
            } else {
                this._error = 'invalid path in query';
            }
        } else {
            this._error = 'invalid path in query';
        }
    }

    private parseDescriptionFilter({ line }: { line: string }): void {
        const descriptionMatch = line.match(this.descriptionRegexp);
        if (descriptionMatch !== null) {
            const filterMethod = descriptionMatch[1];
            if (filterMethod === 'includes') {
                this._filters.push((task: Task) =>
                    this.stringIncludesCaseInsensitive(
                        task.description,
                        descriptionMatch[2],
                    ),
                );
            } else if (descriptionMatch[1] === 'does not include') {
                this._filters.push(
                    (task: Task) =>
                        !this.stringIncludesCaseInsensitive(
                            task.description,
                            descriptionMatch[2],
                        ),
                );
            } else {
                this._error = 'invalid description in query';
            }
        } else {
            this._error = 'invalid description in query';
        }
    }

    private parseHeadingFilter({ line }: { line: string }): void {
        const headingMatch = line.match(this.headingRegexp);
        if (headingMatch !== null) {
            const filterMethod = headingMatch[1].toLowerCase();
            if (filterMethod === 'includes') {
                this._filters.push(
                    (task: Task) =>
                        task.precedingHeader !== null &&
                        this.stringIncludesCaseInsensitive(
                            task.precedingHeader,
                            headingMatch[2],
                        ),
                );
            } else if (headingMatch[1] === 'does not include') {
                this._filters.push(
                    (task: Task) =>
                        task.precedingHeader === null ||
                        !this.stringIncludesCaseInsensitive(
                            task.precedingHeader,
                            headingMatch[2],
                        ),
                );
            } else {
                this._error = 'invalid heading clause in query';
            }
        } else {
            this._error = 'invalid heading clause in query';
        }
    }

    private parseLimit({ line }: { line: string }): void {
        const limitMatch = line.match(this.limitRegexp);
        if (limitMatch !== null) {
            // limitMatch[2] is per regex always digits and therefore parsable.
            const limit = Number.parseInt(limitMatch[2], 10);
            this._limit = limit;
        } else {
            this._error = 'invalid limit clause in query';
        }
    }

    private parseDate(input: string): moment.Moment {
        const cc = chrono.casual.clone();
        cc.parsers.push({
            pattern: () => { return /\bweek of ([0-9]{4}-[0-9]{2}-[0-9]{2})\b/i },
            extract: (context, match) => {
                let m = window.moment(match[1]);
                m.add(1, 'week');
                return {
                    year: m.year(), month: m.month() + 1, day: m.date()
                }
            }
        });

        // Using start of date to correctly match on comparison with other dates (like equality).
        const parsed = cc.parse(input)[0];
        const res = window.moment(parsed.date());
        if (!parsed.start.isCertain("hour") || !parsed.start.isCertain("minute")) {
            res.set({
                hour: 0,
                minute: 0,
            });
        }
        return res;
    }

    private stringIncludesCaseInsensitive(
        haystack: string,
        needle: string,
    ): boolean {
        return haystack
            .toLocaleLowerCase()
            .includes(needle.toLocaleLowerCase());
    }
}
