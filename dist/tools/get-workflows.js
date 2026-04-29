import * as fs from 'node:fs/promises';
import * as path from 'node:path';
export async function getWorkflows(staticDir, params) {
    const filePath = path.join(staticDir, 'workflows.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const workflows = JSON.parse(content);
    if (!params.task)
        return workflows;
    const query = params.task.toLowerCase();
    return workflows.filter((w) => {
        const searchText = [w.name, ...w.tags, ...w.steps].join(' ').toLowerCase();
        return searchText.includes(query);
    });
}
//# sourceMappingURL=get-workflows.js.map