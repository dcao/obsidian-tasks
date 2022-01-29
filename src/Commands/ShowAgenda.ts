import type { Workspace } from 'obsidian';
import { VIEW_TYPE_AGENDA } from 'AgendaView';

export const showAgenda = async (ws: Workspace) => {
    const existing = ws.getLeavesOfType(VIEW_TYPE_AGENDA);
    if (existing.length) {
        ws.revealLeaf(existing[0]);
        return;
    }

    await ws.getRightLeaf(false).setViewState({
        type: VIEW_TYPE_AGENDA,
        active: true,
    });

    ws.revealLeaf(ws.getLeavesOfType(VIEW_TYPE_AGENDA)[0]);
};
