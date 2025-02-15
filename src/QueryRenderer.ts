import {
    App,
    EventRef,
    MarkdownPostProcessorContext,
    MarkdownRenderChild,
    Plugin,
} from 'obsidian';

import { State } from './Cache';
import { Query } from './Query';
import { Sort } from './Sort';
import type { Events } from './Events';
import type { Task } from './Task';

export class QueryRenderer {
    private readonly app: App;
    private readonly events: Events;

    constructor({ plugin, events }: { plugin: Plugin; events: Events }) {
        this.app = plugin.app;
        this.events = events;

        plugin.registerMarkdownCodeBlockProcessor(
            'tasks',
            this.addQueryRenderChild.bind(this),
        );
    }

    private async addQueryRenderChild(
        source: string,
        element: HTMLElement,
        context: MarkdownPostProcessorContext,
    ) {
        context.addChild(
            new QueryRenderChild({
                app: this.app,
                events: this.events,
                container: element,
                source,
                sourcePath: context.sourcePath,
            }),
        );
    }
}

class QueryRenderChild extends MarkdownRenderChild {
    private readonly app: App;
    private readonly events: Events;
    private readonly source: string;
    private readonly sourcePath: string;
    private query: Query;

    private renderEventRef: EventRef | undefined;
    private queryReloadTimeout: NodeJS.Timeout | undefined;

    constructor({
        app,
        events,
        container,
        source,
        sourcePath,
    }: {
        app: App;
        events: Events;
        container: HTMLElement;
        source: string;
        sourcePath: string;
    }) {
        super(container);

        this.app = app;
        this.events = events;
        this.source = source;
        this.sourcePath = sourcePath;

        this.query = new Query({ source });
    }

    onload() {
        // Process the current cache state:
        this.events.triggerRequestCacheUpdate(this.render.bind(this));
        // Listen to future cache changes:
        this.renderEventRef = this.events.onCacheUpdate(this.render.bind(this));

        this.reloadQueryAtMidnight();
    }

    onunload() {
        if (this.renderEventRef !== undefined) {
            this.events.off(this.renderEventRef);
        }

        if (this.queryReloadTimeout !== undefined) {
            clearTimeout(this.queryReloadTimeout);
        }
    }

    /**
     * Reloads the query after midnight to update results from relative date queries.
     *
     * For example, the query `due today` changes every day. This makes sure that all query results
     * are re-rendered after midnight every day to ensure up-to-date results without having to
     * reload obsidian. Creating a new query object from the source re-applies the relative dates
     * to "now".
     */
    private reloadQueryAtMidnight(): void {
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        const now = new Date();

        const millisecondsToMidnight = midnight.getTime() - now.getTime();

        this.queryReloadTimeout = setTimeout(() => {
            this.query = new Query({ source: this.source });
            // Process the current cache state:
            this.events.triggerRequestCacheUpdate(this.render.bind(this));
            this.reloadQueryAtMidnight();
        }, millisecondsToMidnight + 1000); // Add buffer to be sure to run after midnight.
    }

    private async render({ tasks, state }: { tasks: Task[]; state: State }) {
        const content = this.containerEl.createEl('div');
        if (state === State.Warm && this.query.error === undefined) {
            const { taskList, tasksCount } = await this.createTasksList({
                tasks,
                content,
            });
            content.appendChild(taskList);
            if (tasksCount === 0) {
                content.createDiv({
                    text: "no tasks in query",
                    cls: 'tasks-count',
                });
            }
            // content.createDiv({
            //     text: `${tasksCount} task${tasksCount !== 1 ? 's' : ''}`,
            //     cls: 'tasks-count',
            // });
        } else if (this.query.error !== undefined) {
            content.setText(`Tasks query: ${this.query.error}`);
        } else {
            content.setText('Loading Tasks ...');
        }

        this.containerEl.firstChild?.replaceWith(content);
    }

    private async createTasksList({
        tasks,
        content,
    }: {
        tasks: Task[];
        content: HTMLDivElement;
    }): Promise<{ taskList: HTMLUListElement; tasksCount: number }> {
        this.query.filters.forEach((filter) => {
            tasks = tasks.filter(filter);
        });

        const tasksSortedLimited = Sort.byStatusThenDateThenPath(tasks).slice(
            0,
            this.query.limit,
        );
        const tasksCount = tasksSortedLimited.length;

        const taskList = content.createEl('ul');
        taskList.addClasses([
            'contains-task-list',
            'plugin-tasks-query-result',
        ]);

        for (let i = 0; i < tasksCount; i++) {
            const task = tasksSortedLimited[i];

            const listItem = await task.toLi({
                parentUlElement: taskList,
                listIndex: i,
                sourcePath: this.sourcePath,
            });

            taskList.appendChild(listItem);
        }

        return { taskList, tasksCount };
    }
}
