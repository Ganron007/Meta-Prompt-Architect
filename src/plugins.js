const fs = require('fs');
const os = require('os');
const path = require('path');

const PLUGIN_TYPES = ['exporter', 'platform', 'enhancer', 'scanner'];

function validatePlugin(plugin) {
  const errors = [];
  if (!plugin || typeof plugin !== 'object' || Array.isArray(plugin)) {
    return ['plugin must export an object'];
  }
  if (typeof plugin.name !== 'string' || !plugin.name.trim()) errors.push('missing "name"');
  if (!PLUGIN_TYPES.includes(plugin.type)) {
    errors.push(`"type" must be one of: ${PLUGIN_TYPES.join(', ')}`);
    return errors;
  }
  if (typeof plugin.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(plugin.id || '')) {
    errors.push('"id" must use lowercase letters, numbers, hyphens');
  }
  switch (plugin.type) {
    case 'exporter':
      if (typeof plugin.ext !== 'string' || !plugin.ext.startsWith('.')) errors.push('exporter needs "ext" starting with a dot');
      if (typeof plugin.format !== 'function') errors.push('exporter needs a format(prompt, name) function');
      break;
    case 'platform':
      for (const field of ['modes', 'context', 'config', 'playbook', 'strengths']) {
        if (!Array.isArray(plugin[field])) errors.push(`platform needs an array "${field}"`);
      }
      if (typeof plugin.multiAgent !== 'string') errors.push('platform needs a "multiAgent" description');
      if (typeof plugin.terminal !== 'boolean') errors.push('platform needs boolean "terminal"');
      if (typeof plugin.type_ !== 'string' && typeof plugin.platformType !== 'string' && typeof plugin.agentType !== 'string') {
        errors.push('platform needs "agentType" (e.g. "IDE agent") — "type" is reserved for the plugin kind');
      }
      break;
    case 'enhancer':
      if (typeof plugin.enhance !== 'function') errors.push('enhancer needs an enhance(text) function');
      break;
    case 'scanner':
      if (typeof plugin.scan !== 'function') errors.push('scanner needs a scan(projectDir) function');
      break;
  }
  return errors;
}

function normalizePlatform(plugin) {
  const { name, id, modes, context, config, multiAgent, terminal, strengths, playbook } = plugin;
  return {
    name,
    type: plugin.agentType || plugin.platformType || plugin.type_ || 'Custom agent',
    modes, context, config, multiAgent, terminal, strengths, playbook,
    plugin: id
  };
}

function pluginDirectories({ project = process.cwd(), pluginDir } = {}) {
  if (pluginDir) return [path.resolve(pluginDir)];
  return [
    path.join(os.homedir(), '.mpa', 'plugins'),
    path.join(path.resolve(project || process.cwd()), '.mpa', 'plugins')
  ];
}

function loadPlugins(options = {}) {
  const result = { exporters: {}, platforms: {}, enhancers: {}, scanners: {}, loaded: [], errors: [] };
  for (const dir of [...new Set(pluginDirectories(options))]) {
    let entries = [];
    try {
      if (fs.existsSync(dir)) entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      result.errors.push({ file: dir, error: err.message });
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
      const file = path.join(dir, entry.name);
      try {
        const plugin = require(file);
        const errors = validatePlugin(plugin);
        if (errors.length) {
          result.errors.push({ file, error: errors.join('; ') });
          continue;
        }
        if (plugin.type === 'platform') {
          result.platforms[plugin.id] = { ...plugin, normalized: normalizePlatform(plugin) };
        } else {
          result[`${plugin.type}s`][plugin.id] = plugin;
        }
        result.loaded.push(`${plugin.type}:${plugin.id}`);
      } catch (err) {
        result.errors.push({ file, error: err.message });
      }
    }
  }
  return result;
}

module.exports = { PLUGIN_TYPES, validatePlugin, normalizePlatform, pluginDirectories, loadPlugins };
