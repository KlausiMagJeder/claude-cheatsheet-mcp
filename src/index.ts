import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type * as http from 'node:http';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { CatalogIndex } from './types.js';
import { buildIndex } from './scanner/index.js';
import { startWebServer } from './web/server.js';
import { listSkills } from './tools/list-skills.js';
import { listCommands } from './tools/list-commands.js';
import { listAgents } from './tools/list-agents.js';
import { listMcpTools } from './tools/list-mcp-tools.js';
import { listCliCommands } from './tools/list-cli-commands.js';
import { listHooks } from './tools/list-hooks.js';
import { listRoles } from './tools/list-roles.js';
import { getDetail } from './tools/get-detail.js';
import { getStats } from './tools/get-stats.js';
import { getPluginDetail } from './tools/get-plugin-detail.js';
import { getWorkflows } from './tools/get-workflows.js';
import { search } from './tools/search.js';
import { suggest } from './tools/suggest.js';
import { createRefreshHandler } from './tools/refresh.js';

// WARUM fileURLToPath: ESM-natives __dirname-Äquivalent. src/static wird
// beim Build nach dist/static kopiert (package.json build-Script).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.resolve(__dirname, 'static');

const GLOBAL_PATH = process.env.CLAUDE_GLOBAL_PATH ?? path.join(os.homedir(), '.claude');
const PROJECT_PATH = process.env.CLAUDE_PROJECT_PATH || process.cwd();
// WARUM explizit: Autoritativer Ort für User-Scope-MCPs und User-Hooks
// (siehe Domain-Expert-Knowledge `claude-settings-hierarchie.md`, Task-25-Lehre).
// Der Orchestrator hätte zwar einen Default, aber hier sichtbar zu machen
// dokumentiert die Erwartung an der Call-Site.
const USER_CONFIG_PATH =
  process.env.CLAUDE_USER_CONFIG_PATH ?? path.join(os.homedir(), '.claude.json');
const PLUGINS_PATH = process.env.CLAUDE_PLUGINS_PATH ?? path.join(GLOBAL_PATH, 'plugins');

// Explizite Capabilities-Deklaration (MCP-Experte Invariante #4):
// Signalisiert dem Client Klartext, dass dieser Server nur Tools unterstützt
// (keine resources, prompts, completions). Grep-freundlich für spätere Audits.
const server = new McpServer(
  { name: 'claude-cheatsheet-mcp', version: '0.5.0' },
  { capabilities: { tools: {} } },
);

// State-Objekt mit stabiler Referenz. `refresh` mutiert state.index;
// alle Tool-Handler lesen state.index zur Call-Zeit.
const state: { index: CatalogIndex } = {
  index: {
    entries: [],
    scannedAt: new Date(0),
    globalPath: GLOBAL_PATH,
    projectPath: PROJECT_PATH,
  },
};

// ---------------------------------------------------------------------------
// Tool-Registrations — inputSchema ist ZodRawShape (Plain-Object), nie z.object.
// Response-Shape: { content: [{ type: "text", text: <JSON-string> }] }.
// ---------------------------------------------------------------------------

const scopeParam = z.enum(['global', 'project', 'all']).optional().default('all');

server.registerTool(
  'list_skills',
  {
    description: `Lists all installed Claude Code skills (reusable capability definitions from ~/.claude/plugins/ and project-local plugins). Use when the user asks 'which skills do I have', 'what skills are installed', 'show my skills', or wants an overview of available skill-based capabilities. For slash commands (starting with \`/\`), use \`list_commands\` instead; for built-in CLI commands like \`/help\` or \`/clear\`, use \`list_cli_commands\`.`,
    inputSchema: { scope: scopeParam },
  },
  async ({ scope }) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(listSkills(state.index, { scope }), null, 2),
      },
    ],
  }),
);

server.registerTool(
  'list_commands',
  {
    description: `Lists all user-defined slash commands (starting with \`/\`) from ~/.claude/commands/ and project-local command folders. Use when the user asks 'which slash commands are available', 'show my custom commands', 'list commands', or wants to discover invokable \`/command\`-style shortcuts. For built-in CLI commands like \`/help\` or \`/clear\`, use \`list_cli_commands\`; for skills (non-slash capabilities), use \`list_skills\`.`,
    inputSchema: { scope: scopeParam },
  },
  async ({ scope }) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(listCommands(state.index, { scope }), null, 2),
      },
    ],
  }),
);

server.registerTool(
  'list_agents',
  {
    description: `Lists all available Claude Code subagent types (built-in agents plus plugin-provided agents that can be invoked via the Task tool). Use when the user asks 'what agents are available', 'which subagents can I use', 'list agent types', or wants to see delegation targets for the Task tool. For Jarvis roles (team-internal specialist personas), use \`list_roles\` instead.`,
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(listAgents(state.index, {}), null, 2),
      },
    ],
  }),
);

server.registerTool(
  'list_mcp_tools',
  {
    description: `Lists all registered MCP servers from settings.json and the tools each server exposes. Use when the user asks 'which MCP servers are configured', 'what MCP tools do I have', 'list my MCP integrations', 'what can the <server-name> MCP do', or wants an overview of MCP-provided capabilities. Pass \`server\` to filter to a single MCP server. For Claude Code slash commands or skills (not MCP-based), use \`list_commands\` or \`list_skills\`.`,
    inputSchema: { server: z.string().optional() },
  },
  async ({ server: serverName }) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(listMcpTools(state.index, { server: serverName }), null, 2),
      },
    ],
  }),
);

server.registerTool(
  'list_cli_commands',
  {
    description: `Lists built-in Claude Code CLI commands (like \`/help\`, \`/clear\`, \`/model\`, \`/compact\`) that ship with the Claude Code runtime itself. Use when the user asks 'what built-in commands exist', 'which slash commands does Claude Code provide out of the box', or wants reference material for native CLI functionality. For user-defined slash commands, use \`list_commands\`; for skills, use \`list_skills\`.`,
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(listCliCommands(state.index, {}), null, 2),
      },
    ],
  }),
);

server.registerTool(
  'list_hooks',
  {
    description: `Lists all configured hooks from settings.json (PreToolUse, PostToolUse, Stop, UserPromptSubmit, etc.) at global and project scope. Use when the user asks 'which hooks do I have', 'what automations are configured', 'list my hooks', 'show configured PreToolUse handlers', or wants to inspect which events trigger custom shell commands. Hooks are Claude-Code-runtime automations — this tool does not modify them, only lists them.`,
    inputSchema: { scope: scopeParam },
  },
  async ({ scope }) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(listHooks(state.index, { scope }), null, 2),
      },
    ],
  }),
);

server.registerTool(
  'list_roles',
  {
    description: `Lists all Jarvis team roles (specialist personas under ~/.claude/jarvis/rolls/ — e.g. Senior TypeScript Developer, MCP-Experte, Test Engineer, Planungsassistent). Use when the user asks 'which Jarvis roles exist', 'list team roles', 'show specialist roles', or wants to see available delegation targets within the Jarvis role-based workflow. For Claude-Code subagents (Task-tool targets), use \`list_agents\` instead.`,
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(listRoles(state.index, {}), null, 2),
      },
    ],
  }),
);

server.registerTool(
  'get_detail',
  {
    description: `Returns full details for a single catalog entry by ID, including the raw file content (markdown body, frontmatter, source path). Use when the user asks 'show me the full skill definition for X', 'what does the Y command actually do', 'open the file for Z', or wants to inspect a specific entry after discovering it via \`list_*\` or \`search\`. Requires a valid ID from any listing or search result.`,
    inputSchema: { id: z.string() },
  },
  async ({ id }) => {
    const result = await getDetail(state.index, { id });
    if (!result) {
      // Not-Found ist kein isError — Client hat legitim aufgerufen, Entity
      // existiert nur nicht.
      return { content: [{ type: 'text', text: `Entry not found: ${id}` }] };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.registerTool(
  'get_stats',
  {
    description: `Returns summary statistics for the cheatsheet catalog: entry counts per category (skills, commands, agents, MCP tools, CLI commands, hooks, roles), last scan timestamp, and scanned paths. Use when the user asks 'how many skills/commands/hooks do I have', 'show catalog stats', 'give me an overview', or wants a quick size snapshot before diving into \`list_*\` details.`,
    inputSchema: {},
  },
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(getStats(state.index), null, 2) }],
  }),
);

server.registerTool(
  'get_plugin_detail',
  {
    description: `Returns a plugin-centric bundle: for a given plugin name (exact match, case-sensitive), all of its skills, commands, agents, hooks, and MCP tools — grouped by kind — plus install version, marketplace and installPath. Use when the user asks 'what does the <plugin> plugin ship', 'show everything from superpowers', 'list all assets in plugin X', 'pre-update audit of plugin Y', or wants a single-shot inventory per plugin. For one specific entry by ID, use \`get_detail\`; for catalog-wide listings by kind, use \`list_skills\`/\`list_commands\`/\`list_agents\`/\`list_hooks\`/\`list_mcp_tools\`; for substring or keyword matches across all metadata (including partial plugin-name hits) use \`search\` instead. Returns \`{ found: false, ... }\` (no error) if the plugin name has no installed entries.`,
    inputSchema: { pluginName: z.string().min(1) },
  },
  async ({ pluginName }) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(getPluginDetail(state.index, { pluginName }), null, 2),
      },
    ],
  }),
);

server.registerTool(
  'get_workflows',
  {
    description: `Returns curated workflow templates (ordered sequences of skills, commands and agents for recurring tasks like 'build a feature', 'fix a bug', 'review a PR', 'investigate a Rollbar incident'). Use when the user asks 'how do I typically do X', 'what's the workflow for Y', 'show me a feature-building recipe', or wants guidance on combining multiple catalog entries into a sequence. Pass \`task\` to filter for a specific workflow theme.`,
    inputSchema: { task: z.string().optional() },
  },
  async ({ task }) => {
    const result = await getWorkflows(STATIC_DIR, { task });
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.registerTool(
  'search',
  {
    description: `Full-text search across names, descriptions and tags of every catalog entry (skills, commands, agents, MCP tools, CLI commands, hooks, roles). Use when the user asks 'is there a tool for Jira', 'find anything related to testing', 'search for deployment', or has a keyword but does not know the exact category. Pass \`kind\` to restrict to one entity type. For task-oriented recommendations (what should I use for X), use \`suggest\`; for one specific known entity by ID, use \`get_detail\`.`,
    inputSchema: {
      query: z.string(),
      kind: z
        .enum(['skill', 'command', 'agent', 'mcp_tool', 'cli_command', 'hook', 'role'])
        .optional(),
    },
  },
  async ({ query, kind }) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(search(state.index, { query, kind }), null, 2),
      },
    ],
  }),
);

server.registerTool(
  'suggest',
  {
    description: `Recommends relevant skills, commands, agents and MCP tools for a described task, ranked by keyword relevance. Use when the user asks 'what should I use to review a PR', 'which tool helps with debugging', 'recommend something for deployment', 'I want to do X — what's the best fit', or otherwise wants a ranked shortlist based on their intent rather than exact keywords. For raw keyword search, use \`search\`; for a specific category listing, use a \`list_*\` tool.`,
    inputSchema: { task: z.string() },
  },
  async ({ task }) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify(suggest(state.index, { task }), null, 2),
      },
    ],
  }),
);

const refreshHandler = createRefreshHandler(buildIndex, state);
server.registerTool(
  'refresh',
  {
    description: `Re-scans ~/.claude and the project plugin folders to rebuild the in-memory catalog index. Use when the user has just installed a new plugin, added a new skill/command, edited settings.json, switched projects, or asks 'reload the catalog', 'rescan my plugins', 'refresh the index', 'I added a new skill — pick it up'. Pass \`projectPath\` to scan a different project folder than the current one.`,
    inputSchema: { projectPath: z.string().optional() },
  },
  async ({ projectPath }) => {
    const result = await refreshHandler({ projectPath });
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);

// ---------------------------------------------------------------------------
// Lifecycle: Graceful Shutdown für SIGINT/SIGTERM.
// Ohne Handler beendet Node
// sofort, laufende Tool-Calls werden gecuttet.
// ---------------------------------------------------------------------------

let shuttingDown = false;
let webServer: http.Server | null = null;

async function shutdown(reason: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  // Stdio-Reinheit: stderr, niemals stdout — sonst zerstört der Shutdown-Log
  // das JSON-RPC-Framing.
  console.error(`[claude-cheatsheet-mcp] shutting down (${reason})`);
  try {
    // Reihenfolge: Erst Web-Server schließen (stoppt neue HTTP-Requests, die
    // sonst auf bereits geschlossenen State zugreifen könnten), dann MCP.
    if (webServer) {
      await new Promise<void>((resolve) => {
        webServer!.close(() => resolve());
      });
    }
    await server.close();
  } catch (err) {
    console.error('[claude-cheatsheet-mcp] error during shutdown:', err);
    process.exit(1);
    return;
  }
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Initialer Index-Aufbau VOR connect — so sehen die ersten Tool-Calls
  // bereits valide Daten.
  state.index = await buildIndex(
    GLOBAL_PATH,
    PROJECT_PATH,
    STATIC_DIR,
    USER_CONFIG_PATH,
    PLUGINS_PATH,
  );

  // Kill-Switch - In Umgebungen, in denen das Dashboard
  // unerwünscht ist (CI, Remote-MCP-Hosts, restriktive Security-Policies),
  // kann der Web-Server deaktiviert werden. Alles außer "1" startet ihn.
  if (process.env.CHEATSHEET_WEB_DISABLED !== '1') {
    const webPort = Number.parseInt(process.env.CHEATSHEET_WEB_PORT ?? '37778', 10);
    webServer = startWebServer(state, STATIC_DIR, webPort);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[claude-cheatsheet-mcp] ready on stdio');
}

main().catch((err) => {
  console.error('Failed to start cheatsheet MCP server:', err);
  process.exit(1);
});
