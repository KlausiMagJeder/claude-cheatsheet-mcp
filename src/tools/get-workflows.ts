import * as fs from 'node:fs/promises';
import * as path from 'node:path';

interface Workflow {
  name: string;
  tags: string[];
  steps: string[];
}

interface GetWorkflowsParams {
  task?: string;
}

export async function getWorkflows(
  staticDir: string,
  params: GetWorkflowsParams,
): Promise<Workflow[]> {
  const filePath = path.join(staticDir, 'workflows.json');
  const content = await fs.readFile(filePath, 'utf-8');
  const workflows: Workflow[] = JSON.parse(content) as Workflow[];

  if (!params.task) return workflows;

  const query = params.task.toLowerCase();
  return workflows.filter((w) => {
    const searchText = [w.name, ...w.tags, ...w.steps].join(' ').toLowerCase();
    return searchText.includes(query);
  });
}
