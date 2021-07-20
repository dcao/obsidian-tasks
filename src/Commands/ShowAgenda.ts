import type { Workspace } from 'obsidian';
import { VIEW_TYPE_AGENDA } from 'AgendaView';

export const showAgenda = (ws: Workspace) => {
    if (ws.getLeavesOfType(VIEW_TYPE_AGENDA).length > 0) {
        return;
    }
    ws.getRightLeaf(true).setViewState({
        type: VIEW_TYPE_AGENDA,
    });
};
