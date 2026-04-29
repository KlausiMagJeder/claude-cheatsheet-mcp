import { toShort } from '../types.js';
export function createListHandler(kind) {
    return function handler(index, params) {
        let entries = index.entries.filter((e) => e.kind === kind);
        if (params.scope && params.scope !== 'all') {
            entries = entries.filter((e) => e.scope === params.scope);
        }
        return entries.map(toShort);
    };
}
export const listSkills = createListHandler('skill');
//# sourceMappingURL=list-skills.js.map