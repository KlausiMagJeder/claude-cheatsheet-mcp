export interface InstalledPluginRef {
    plugin: string;
    marketplace: string;
    version: string;
    installPath: string;
}
/**
 * Liest und parst `<pluginsPath>/installed_plugins.json`.
 *
 * @param pluginsPath Absoluter Pfad zu `~/.claude/plugins/` (oder ein Testordner).
 * @returns Array der installierten Plugin-Refs — oder `null`, wenn die Datei
 *          fehlt bzw. nicht geparst werden kann (Caller fällt dann auf Glob).
 */
export declare function readInstalledPlugins(pluginsPath: string): Promise<InstalledPluginRef[] | null>;
