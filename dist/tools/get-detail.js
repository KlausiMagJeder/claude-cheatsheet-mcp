import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
const CLAUDE_HOME = path.join(os.homedir(), '.claude');
function isAllowedPath(filePath, index) {
    const isUnder = (base) => filePath === base || filePath.startsWith(base + path.sep);
    if (isUnder(CLAUDE_HOME))
        return true;
    if (isUnder(index.globalPath))
        return true;
    if (index.projectPath && isUnder(index.projectPath))
        return true;
    return false;
}
export async function getDetail(index, params) {
    const entry = index.entries.find((e) => e.id === params.id);
    if (!entry)
        return null;
    let content;
    if (entry.filePath) {
        if (!isAllowedPath(entry.filePath, index)) {
            return { entry };
        }
        try {
            content = await fs.readFile(entry.filePath, 'utf-8');
        }
        catch {
            // File not readable — return entry without content
        }
    }
    return { entry, content };
}
//# sourceMappingURL=get-detail.js.map