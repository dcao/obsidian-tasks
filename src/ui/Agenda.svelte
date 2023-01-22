<script lang="ts">
    import { onDestroy } from 'svelte';

    import type { Events } from 'Events';
    import { Status, Task } from 'Task';

    import Calendar from '@event-calendar/core';
    import '@event-calendar/core/index.css';
    import TimeGrid from '@event-calendar/time-grid';
    import DayGrid from '@event-calendar/day-grid';
    import List from '@event-calendar/list';
    import moment from 'moment';
import { Recurrence } from 'Recurrence';

    export let events: Events;
    export let tasks: Task[];
    export let onClickDay: any;
    export let onClickEvent: any;

    // let tasks: Task[] = [];

    let sub = events.onCacheUpdate((data) => {
        tasks = data.tasks;
    });

    onDestroy(() => events.off(sub));

    // Calendar stuff
    let plugins = [TimeGrid, DayGrid, List];
    let getEnd = (start, stop) => {
        // console.log(start);
        if (stop) {
            if (stop.diff(stop.clone().startOf('day'), 'minutes') == 0) {
                // It's a plain date. Set to 11:59:59p of day
                let res = stop.clone();
                res.set({'hour': 23, 'minute': 59, 'second': 59});

                return res;
            } else {
                return stop;
            }
        } else {
            return start!.clone().add(1, 'hour');
        }

        // const end = t.schedStop
        //     ? t.schedStop
        //     : t.schedStart!.clone().add(1, 'hour');
    };

    let getTasks = (tasks) => {
        return tasks
            .filter((t) => t.dueStart !== null || t.schedStart !== null)
            .flatMap((t) => {
                let list = [];

                if (t.schedStart) {
                    // console.log("get end from start");
                    // console.log(t);
                    const end = getEnd(t.schedStart, t.schedStop);
                    list.push({
                        start: t.schedStart?.toDate(),
                        end: end.toDate(),
                        title:
                            t.precedingHeader !== null
                                ? `${t.description} (${t.path} > ${t.precedingHeader})`
                                : `${t.description} (${t.path})`,
                        backgroundColor:
                            t.status === Status.Done
                                ? 'gray'
                                : '#2b5b80',
                        extendedProps: {
                            path: t.path,
                            line: t.sectionStart,
                        },
                    });
                }

                if (t.dueStart) {
                    // console.log("get end from due");
                    // console.log(t);
                    const end = getEnd(t.dueStart, t.dueStop);
                    list.push({
                        start: t.dueStart?.toDate(),
                        end: end.toDate(),
                        title:
                            t.precedingHeader !== null
                                ? `${t.description} (${t.path} > ${t.precedingHeader})`
                                : `${t.description} (${t.path})`,
                        backgroundColor:
                            t.status === Status.Done
                                ? 'gray'
                                : '#705023',
                        extendedProps: {
                            path: t.path,
                            line: t.sectionStart,
                        },
                    });
                }

                // Then add a few recurrences down here
                if (t.recurrence && t.status == Status.Todo) {
                    // We basically build a recurrence and repeatedly call next on it.
                    let re_cur = t.recurrence;

                    // Add seven recurrences. Why seven? Why not :^)
                    // TODO: In the future, # of recurrences can be adaptive
                    for (let i = 0; i < 3; i++) {
                        if (re_cur.next() == null) {
                            break;
                        }

                        let x = re_cur.next()!;
                        // Set the next recurrence
                        re_cur = Recurrence.fromDates({
                            rrule: t.recurrence.rrule,
                            schedStart: x.schedStart,
                            schedStop: x.schedStop,
                            dueStart: x.dueStart,
                            dueStop: x.dueStop,
                        });

                        // Add the task
                        if (x.schedStart) {
                            // console.log("get end from sched recur");
                            // console.log(t);
                            const end = getEnd(x.schedStart, x.schedStop);
                            list.push({
                                start: x.schedStart?.toDate(),
                                end: end.toDate(),
                                title:
                                    t.precedingHeader !== null
                                        ? `${t.description} (${t.path} > ${t.precedingHeader})`
                                        : `${t.description} (${t.path})`,
                                // A hack to change the text color and the bg color lmao
                                backgroundColor: 'var(--hl2);color:var(--text-normal)',
                                extendedProps: {
                                    path: t.path,
                                    line: t.sectionStart,
                                },
                            });
                        }

                        if (x.dueStart) {
                            const end = getEnd(x.dueStart, x.dueStop);
                            list.push({
                                start: x.dueStart?.toDate(),
                                end: end.toDate(),
                                title:
                                    t.precedingHeader !== null
                                        ? `${t.description} (${t.path} > ${t.precedingHeader})`
                                        : `${t.description} (${t.path})`,
                                backgroundColor: 'gray',
                                extendedProps: {
                                    path: t.path,
                                    line: t.sectionStart,
                                },
                            });
                        }
                    }
                }

                return list;
            })
            .concat([
                {
                    start: new Date(),
                    end: moment().add(1, 'minute').toDate(),
                    title: 'Current time',
                    backgroundColor: 'red',
                    extendedProps: {
                        path: "",
                        line: 0,
                    },
                },
            ]);
    };

    $: options = {
        view: 'timeGridDay',
        headerToolbar: {
            start: 'title',
            center: '',
            end: 'timeGridDay,timeGridWeek,listWeek,today prev,next',
        },
        buttonText: {
            today: 't',
            // dayGridMonth: 'm',
            listDay: 'l',
            listWeek: 'l',
            listMonth: 'l',
            listYear: 'l',
            resourceTimeGridDay: 'd',
            resourceTimeGridWeek: 'w',
            timeGridDay: 'd',
            timeGridWeek: 'w',
        },
        dateClick: onClickDay,
        eventClick: onClickEvent,
        eventContent: (ei: any) =>
            `<div class="ec-event-title">${
                ei.event.title
            }</div><div class="ec-event-time">${new Intl.DateTimeFormat(
                'en-US',
                { timeStyle: 'short' },
            ).format(ei.event.start)} - ${new Intl.DateTimeFormat('en-US', {
                timeStyle: 'short',
            }).format(ei.event.end)}</div>`,
        dayHeaderFormat: { weekday: 'short', day: 'numeric' },
        events: getTasks(tasks),
    };
</script>

<div class="parent" style="padding: 10px 0 0 8px;">
    <Calendar {plugins} {options} />
</div>

<style>
    .parent :global(.ec-button) {
        font-size: 0.6rem;
        padding-left: 0.2rem;
        padding-right: 0.2rem;
        margin-right: 0;
        line-height: 0.65rem;
    }

    .parent :global(.ec-time),
    .parent :global(.ec-header .ec-day),
    .parent :global(.ec-day-head) {
        font-family: var(--font-monospace);
        font-size: 0.5rem;
    }

    .parent :global(.ec-day) {
        background-color: var(--background-primary);
    }

    .parent :global(.ec-title) {
        font-size: 1.15rem;
    }

    .parent :global(.ec-event) {
        overflow: hidden;
    }

    .parent :global(.ec-event-time) {
        font-size: 0.5rem;
        font-family: var(--font-monospace);
    }

    .parent :global(.ec-event-title) {
        font-size: 0.65rem;
        overflow: visible;
    }

    .parent :global(.ec-header),
    .parent :global(.ec-body),
    .parent :global(.ec-days),
    .parent :global(.ec-day) {
        border-color: var(--background-secondary-alt);
    }

    .parent :global(.ec-today) {
        background-color: var(--background-modifier-border);
    }

    .parent :global(.ec-line:not(:first-child):after) {
        border-bottom: 1px solid var(--background-secondary-alt);
    }

    .parent :global(.ec-list .ec-day) {
        font-weight: normal;
        font-size: 0.85rem;
    }
</style>
