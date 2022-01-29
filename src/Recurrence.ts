import type { Moment } from 'moment';
import { RRule } from 'rrule';

export class Recurrence {
    private readonly rrule: RRule;

    private readonly schedStart: Moment | null;
    private readonly schedStop: Moment | null;

    private readonly dueStart: Moment | null;
    private readonly dueStop: Moment | null;

    /**
     * The reference date is used to calculate future occurences.
     *
     * Future occurences will recur based on the reference date.
     * The reference date is the due date, if it is given.
     * Otherwise the scheduled date, if it is given. And so on.
     *
     * Recurrence of all dates will be kept relative to the reference date.
     * For example: if the due date and the start date are given, the due date
     * is the reference date. Future occurrences will have a start date with the
     * same relative distance to the due date as the original task. For example
     * "starts one week before it is due".
     */
    private readonly referenceDate: Moment | null;

    constructor({
        rrule,
        referenceDate,
        schedStart,
        schedStop,
        dueStart,
        dueStop,
    }: {
        rrule: RRule;
        referenceDate: Moment | null;
        schedStart: Moment | null;
        schedStop: Moment | null;
        dueStart: Moment | null;
        dueStop: Moment | null;
    }) {
        this.rrule = rrule;
        this.referenceDate = referenceDate;
        this.schedStart = schedStart;
        this.schedStop = schedStop;
        this.dueStart = dueStart;
        this.dueStop = dueStop;
    }

    public static fromText({
        recurrenceRuleText,
        schedStart,
        schedStop,
        dueStart,
        dueStop,
    }: {
        recurrenceRuleText: string;
        schedStart: Moment | null;
        schedStop: Moment | null;
        dueStart: Moment | null;
        dueStop: Moment | null;
    }): Recurrence | null {
        try {
            const options = RRule.parseText(recurrenceRuleText);
            if (options !== null) {
                // Pick the reference date for recurrence based on importance.
                // Assuming due date has the highest priority.
                let referenceDate: Moment | null = null;
                // Clone the moment objects.
                if (dueStart) {
                    referenceDate = window.moment(dueStart);
                } else if (schedStart) {
                    referenceDate = window.moment(schedStart);
                }

                if (referenceDate !== null) {
                    options.dtstart = window
                        .moment(referenceDate)
                        .utc(true)
                        .toDate();
                }

                options.byhour = null;
                options.byminute = null;
                options.bysecond = null;

                const rrule = new RRule(options);
                return new Recurrence({
                    rrule,
                    referenceDate,
                    schedStart,
                    schedStop,
                    dueStart,
                    dueStop,
                });
            }
        } catch (error) {
            // Could not read recurrence rule. User possibly not done typing.
        }

        return null;
    }

    public toText(): string {
        return this.rrule.toText();
    }

    /**
     * Returns the dates of the next occurrence or null if there is no next occurrence.
     */
    public next(): {
        schedStart: Moment | null;
        schedStop: Moment | null;
        dueStart: Moment | null;
        dueStop: Moment | null;
    } | null {
        // The next occurrence should happen based on the original reference
        // date if possible. Otherwise, base it on today.
        let after: Moment;
        if (this.referenceDate !== null) {
            // Clone to not alter the original reference date.
            after = window.moment(this.referenceDate);
        } else {
            after = window.moment();
        }

        // after.endOf('day');
        after.utc(true);

        var next = this.rrule.after(after.toDate());

        if (next !== null) {
            // Re-add the timezone that RRule disregarded:
            const nextOccurrence = window.moment.utc(next).local(true);

            // Keep the relative difference between the reference date and
            // start/scheduled/due.
            let schedStart: Moment | null = null;
            let schedStop: Moment | null = null;
            let dueStart: Moment | null = null;
            let dueStop: Moment | null = null;

            // Only if a reference date is given. A reference date will exist if at
            // least one of the other dates is set.
            if (this.referenceDate) {
                if (this.schedStart) {
                    const originalDifference = window.moment.duration(
                        this.schedStart.diff(this.referenceDate),
                    );

                    // Cloning so that original won't be manipulated:
                    schedStart = window.moment(nextOccurrence);

                    // TODO: deal with dst properly
                    schedStart.add(originalDifference);

                    // Deal with stop time
                    if (this.schedStop) {
                        const startStopDiff = window.moment.duration(
                            this.schedStop.diff(this.schedStart),
                        );

                        schedStop = window.moment(schedStart);
                        schedStop.add(startStopDiff);
                    }
                }
                if (this.dueStart) {
                    const originalDifference = window.moment.duration(
                        this.dueStart.diff(this.referenceDate),
                    );

                    // Cloning so that original won't be manipulated:
                    dueStart = window.moment(nextOccurrence);

                    // TODO: deal with dst properly
                    dueStart.add(originalDifference);

                    // Deal with stop time
                    if (this.dueStop) {
                        const startStopDiff = window.moment.duration(
                            this.dueStop.diff(this.dueStart),
                        );

                        dueStop = window.moment(dueStart);
                        dueStop.add(startStopDiff);
                    }
                }
            } else {
                // Set new sched date.
                schedStart = nextOccurrence;
            }

            return {
                schedStart,
                schedStop,
                dueStart,
                dueStop,
            };
        }

        return null;
    }
}