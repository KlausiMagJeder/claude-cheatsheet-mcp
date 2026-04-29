import { getWorkflows } from '../../tools/get-workflows.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_STATIC_DIR = path.resolve(__dirname, '..', '..', 'static');

/**
 * The behavioural tests below build their own tmp staticDir with a
 * controlled `workflows.json` fixture. WARUM: The repo default
 * (`src/static/workflows.json`) is intentionally shipped empty (`[]`)
 * so public consumers do not inherit user-specific workflow templates
 * referencing plugins/skills they have not installed. Tests must not
 * depend on that file's content.
 */
describe('getWorkflows', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cheatsheet-workflows-'));
    const fixture = [
      {
        name: 'Bug fixen',
        tags: ['debugging', 'testing'],
        steps: ['systematic-debugging', 'test-driven-development'],
      },
      {
        name: 'Feature bauen',
        tags: ['feature', 'planning'],
        steps: ['brainstorming', 'writing-plans'],
      },
      {
        name: 'PR erstellen',
        tags: ['git', 'review'],
        steps: ['review-pr'],
      },
    ];
    fs.writeFileSync(path.join(tmpDir, 'workflows.json'), JSON.stringify(fixture));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns all workflows when no task given', async () => {
    const result = await getWorkflows(tmpDir, {});
    expect(result).toHaveLength(3);
  });

  it('filters by task keyword (case-insensitive match in name/tags/steps)', async () => {
    const result = await getWorkflows(tmpDir, { task: 'bug' });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Bug fixen');
  });

  it('returns empty array for unmatched task', async () => {
    const result = await getWorkflows(tmpDir, { task: 'xyznonexistent' });
    expect(result).toEqual([]);
  });

  // Public-release invariant: repo default ships empty so no user-specific
  // templates leak into other developers' installs. Documents the shape
  // contract of the shipped file so a future regression (e.g. someone
  // committing a populated default) gets caught immediately.
  it('repo default ships as an empty array', async () => {
    const result = await getWorkflows(REPO_STATIC_DIR, {});
    expect(result).toEqual([]);
  });
});
