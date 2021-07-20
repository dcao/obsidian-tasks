<script lang="ts">
    import { onDestroy } from 'svelte';

    import type { Events } from 'Events';
    import { Status, Task } from 'Task';

    import Calendar from '@event-calendar/core';
    import '@event-calendar/core/index.css';
    import TimeGrid from '@event-calendar/time-grid';
    import List from '@event-calendar/list';
    import moment from 'moment';

    export let events: Events;

    let tasks: Task[] = [];

    let sub = events.onCacheUpdate((data) => {
        tasks = data.tasks;
    });

    onDestroy(() => events.off(sub));

    // Calendar stuff
    let plugins = [TimeGrid, List];
    $: options = {
        view: 'timeGridWeek',
        headerToolbar: {
            start: 'title',
            center: '',
            end: 'timeGridDay,timeGridWeek,listWeek prev,next',
        },
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
        events: tasks
            .filter((t) => t.dueStart !== null)
            .map((t) => {
                const end = t.dueStop
                    ? t.dueStop
                    : t.dueStart!.clone().add(1, 'hour');
                return {
                    start: t.dueStart?.toDate(),
                    end: end.toDate(),
                    title: t.description,
                    backgroundColor: t.status === Status.Done ? 'gray' : 'var(--interactive-accent)',
                };
            })
            .concat([
                {
                    start: new Date(),
                    end: moment().add(1, 'minute').toDate(),
                    title: 'Current time',
                    backgroundColor: 'red',
                },
            ]),
    };
</script>

<div class="parent">
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
    .parent :global(.ec-header .ec-day) {
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
