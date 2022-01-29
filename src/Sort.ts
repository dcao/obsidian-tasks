import type { Moment } from 'moment';
import type { Task } from './Task';

export class Sort {
    public static byStatusThenDateThenPath(tasks: Task[]): Task[] {
        return tasks.sort(Sort.compareByStatus);
    }

    private static compareByStatus(a: Task, b: Task): -1 | 0 | 1 {
        if (a.status < b.status) {
            return 1;
        } else if (a.status > b.status) {
            return -1;
        } else {
            return Sort.compareByDate(a, b);
        }
    }

    private static compareByDate(a: Task, b: Task): -1 | 0 | 1 {
        // Pick the first date for a and b
        let da = this.pickDate(a);
        let db = this.pickDate(b);

        if (da !== null && db === null) {
            return -1;
        } else if (da === null && db !== null) {
            return 1;
        } else if (da !== null && db !== null) {
            if (da.isAfter(db)) {
                return 1;
            } else if (da.isBefore(db)) {
                return -1;
            } else {
                return Sort.compareByPath(a, b);
            }
        } else {
            return Sort.compareByPath(a, b);
        }
    }

    private static pickDate(t: Task): Moment | null {
        // We want to pick the first available date for t
        if (t.dueStart === null && t.schedStart === null) {
            return null;
        } else if (t.dueStart !== null && t.schedStart === null) {
            return t.dueStart
        } else if (t.dueStart === null && t.schedStart !== null) {
            return t.schedStart
        } else {
            if (t.dueStart!.isBefore(t.schedStart!)) {
                return t.dueStart;
            } else {
                return t.schedStart;
            }
        }
    }

    private static compareByPath(a: Task, b: Task): -1 | 0 | 1 {
        if (a.path < b.path) {
            return -1;
        } else if (a.path > b.path) {
            return 1;
        } else {
            return 0;
        }
    }
}
