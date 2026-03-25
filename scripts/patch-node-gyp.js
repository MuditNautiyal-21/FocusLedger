/**
 * Patches node-gyp AND @electron/node-gyp to recognize Visual Studio 2025 (v18).
 * Run automatically via postinstall.
 *
 * VS 2025 ships with:
 *   - MSVC 14.50.x
 *   - Platform Toolset: v145
 *   - MSBuild targets in v180/ directory
 *
 * node-gyp only recognizes VS 2017 (v15), 2019 (v16), 2022 (v17).
 * This patch adds v18 → 2025 → toolset v145 to ALL copies.
 */
const fs = require('fs');
const path = require('path');

const filesToPatch = [
  path.join(__dirname, '..', 'node_modules', '@electron', 'node-gyp', 'lib', 'find-visualstudio.js'),
  path.join(__dirname, '..', 'node_modules', 'node-gyp', 'lib', 'find-visualstudio.js'),
];

let totalPatched = 0;

for (const filePath of filesToPatch) {
  const label = filePath.includes('@electron') ? '@electron/node-gyp' : 'node-gyp';

  if (!fs.existsSync(filePath)) {
    console.log(`[patch-node-gyp] ${label} not found, skipping.`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('versionYear = 2025')) {
    console.log(`[patch-node-gyp] ${label} already patched.`);
    continue;
  }

  let patched = false;

  // 1. Add version 18 → year 2025 mapping
  //    Works for both async (return ret) and callback-based styles
  const versionPatterns = [
    // Async style (@electron/node-gyp)
    {
      match: `if (ret.versionMajor === 17) {\n      ret.versionYear = 2022\n      return ret\n    }`,
      replace: `if (ret.versionMajor === 17) {\n      ret.versionYear = 2022\n      return ret\n    }\n    if (ret.versionMajor === 18) {\n      ret.versionYear = 2025\n      return ret\n    }`
    },
    // Callback style (node-gyp)
    {
      match: `if (ret.versionMajor === 17) {\n      ret.versionYear = 2022\n      return ret\n    }\n    this.log.silly`,
      replace: `if (ret.versionMajor === 17) {\n      ret.versionYear = 2022\n      return ret\n    }\n    if (ret.versionMajor === 18) {\n      ret.versionYear = 2025\n      return ret\n    }\n    this.log.silly`
    }
  ];

  for (const { match, replace } of versionPatterns) {
    if (content.includes(match)) {
      content = content.replace(match, replace);
      patched = true;
      break;
    }
  }

  // 2. Add toolset v145 for year 2025
  const toolsetMatch = `} else if (versionYear === 2022) {\n      return 'v143'\n    }`;
  const toolsetReplace = `} else if (versionYear === 2022) {\n      return 'v143'\n    } else if (versionYear === 2025) {\n      return 'v145'\n    }`;

  if (content.includes(toolsetMatch)) {
    content = content.replace(toolsetMatch, toolsetReplace);
    patched = true;
  }

  // 3. Add 2025 to supportedYears arrays (only in @electron/node-gyp)
  if (content.includes('[2019, 2022]')) {
    content = content.replace(/\[2019, 2022\]/g, '[2019, 2022, 2025]');
    patched = true;
  }

  if (patched) {
    fs.writeFileSync(filePath, content);
    console.log(`[patch-node-gyp] ✅ Patched ${label} for VS 2025 (v18, toolset v145).`);
    totalPatched++;
  } else {
    console.log(`[patch-node-gyp] ⚠️  ${label}: could not find expected patterns.`);
  }
}

if (totalPatched > 0) {
  console.log(`[patch-node-gyp] Done — ${totalPatched} file(s) patched.`);
} else {
  console.log('[patch-node-gyp] No files needed patching.');
}
