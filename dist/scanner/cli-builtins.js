import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createEntryId } from '../types.js';
export async function scanCliBuiltins(staticDir) {
    const filePath = path.join(staticDir, 'cli-builtins.json');
    let content;
    try {
        content = await fs.readFile(filePath, 'utf-8');
    }
    catch {
        return [];
    }
    // WARUM silent []: Konsistent mit installed-plugins.ts/hooks.ts —
    // malformed JSON darf den gesamten Scanner nicht crashen.
    let builtins;
    try {
        builtins = JSON.parse(content);
    }
    catch {
        return [];
    }
    return builtins.map((cmd) => ({
        id: createEntryId('cli_command', cmd.name),
        kind: 'cli_command',
        name: cmd.name,
        description: cmd.description,
        tags: [],
        scope: 'global',
        source: 'built-in',
        metadata: {},
    }));
}
//# sourceMappingURL=cli-builtins.js.map