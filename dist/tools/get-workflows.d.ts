interface Workflow {
    name: string;
    tags: string[];
    steps: string[];
}
interface GetWorkflowsParams {
    task?: string;
}
export declare function getWorkflows(staticDir: string, params: GetWorkflowsParams): Promise<Workflow[]>;
export {};
