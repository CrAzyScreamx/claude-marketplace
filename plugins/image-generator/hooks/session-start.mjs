/**
 * image-generator SessionStart hook
 *
 * Injects the absolute path to generate.js into the session context so Claude
 * can call it directly via the Bash tool without needing to know the install path.
 */

import path from 'path';
import { fileURLToPath } from 'url';

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;

if (!pluginRoot) {
  // No plugin root — skip silently
  process.exit(0);
}

const scriptPath = path.join(pluginRoot, 'scripts', 'generate.js');

const output = {
  additionalContext:
    `[image-generator] Tool script ready.\n` +
    `To generate an image, use the Bash tool:\n` +
    `  node "${scriptPath}" "<prompt>" [--model <model-id>] [--output-dir <dir>]\n` +
    `\n` +
    `Default model: google/gemini-3.1-flash-image-preview\n` +
    `Requires: OPENROUTER_API_KEY in environment`,
};

process.stdout.write(JSON.stringify(output) + '\n');
