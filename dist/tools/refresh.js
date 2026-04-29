export function createRefreshHandler(buildIndex, state) {
    return async function refresh(params) {
        const globalPath = state.index.globalPath;
        const projectPath = params.projectPath ?? state.index.projectPath;
        const newIndex = await buildIndex(globalPath, projectPath);
        state.index = newIndex;
        return {
            scannedAt: newIndex.scannedAt.toISOString(),
            totalEntries: newIndex.entries.length,
        };
    };
}
//# sourceMappingURL=refresh.js.map