export const pluginSnippet = `// Load a plugin via WidgetRegistry
console.log('Loading plugin: market-heatmap')

// In real runtime this would use PluginLoader
const registered = WidgetRegistry.getList()
console.log('Currently registered widgets:', registered.map((w: any) => w.id))

console.log('✅ Plugin loaded')`
