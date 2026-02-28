# CemToolbox

**Version:** 1.0.0 | **Compatibility:** After Effects CC 2018+

A production-ready, dockable ScriptUI Panel that acts as a drop-in launcher
for your `.jsx` tool scripts and `.ffx` animation presets — all from one tidy
panel in the AE Window menu.

---

## File Tree

```
Scripts/
└── ScriptUI Panels/
    ├── CemToolbox.jsx          ← Main panel file  (install here)
    └── CemToolbox/             ← Sibling data folder (same directory)
        ├── tools/              ← Your .jsx tool scripts
        │   ├── hello_world.jsx
        │   └── layer_renamer.jsx
        ├── presets/            ← Your .ffx animation presets (subfolders OK)
        ├── icons/              ← Optional .png icons for tools
        ├── data/               ← Auto-created runtime data
        │   ├── manifest.json   ← Tool registry  ← EDIT THIS to add tools
        │   ├── settings.json   ← Persisted user settings  (auto-managed)
        │   └── log.txt         ← Error/info log  (auto-managed)
        ├── lib/                ← Optional shared JSX libraries
        └── docs/               ← Optional documentation
```

The panel resolves all paths relative to `$.fileName` (the location of
`CemToolbox.jsx`), so it works regardless of which drive or folder AE is
installed on. **Never hard-code absolute paths.**

---

## Install Steps (Manual)

1. **Locate your Scripts folder.**
   - macOS: `~/Library/Application Support/Adobe/After Effects <version>/Scripts/`
   - Windows: `%APPDATA%\Adobe\After Effects <version>\Scripts\`
   - Or via AE: *Edit → Preferences → Scripting & Expressions → Scripts folder* (button)

2. **Copy both items into `Scripts/ScriptUI Panels/`:**
   ```
   CemToolbox.jsx        ← the panel script
   CemToolbox/           ← the sibling data folder
   ```
   The `CemToolbox/` folder is created automatically on first launch if
   missing, but copying it pre-filled saves a step.

3. **Allow scripts to run AE UI** (one-time):
   *Edit → Preferences → Scripting & Expressions*
   ✅ "Allow Scripts to Write Files and Access Network"

4. **Restart After Effects** (or use *File → Scripts → Re-run Last Script*
   if AE was already open).

5. **Open the panel:** *Window → CemToolbox*
   Dock it anywhere like any native panel.

---

## Manifest Format — Registering Tools

`CemToolbox/data/manifest.json` is the single source of truth for the panel.

```json
{
  "version": "1.0.0",
  "name": "My CemToolbox Manifest",

  "tools": [
    {
      "id":               "my_tool",
      "title":            "My Tool",
      "description":      "One-line description shown in the panel.",
      "category":         "My Category",
      "script":           "tools/my_tool.jsx",
      "entry":            null,
      "needsSelection":   false,
      "supportsCompOnly": false,
      "destructive":      false,
      "icon":             null,
      "version":          "1.0.0",
      "tags":             ["example"]
    }
  ]
}
```

### Field Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Unique identifier (no spaces). Used for favourites persistence. |
| `title` | string | ✅ | Display name in the panel. |
| `description` | string | — | Short one-liner shown in the tool list. |
| `category` | string | — | Groups tools in the sidebar. Defaults to `"Uncategorized"`. |
| `script` | string | ✅ | Path **relative to `CemToolbox/`** root, e.g. `"tools/my_tool.jsx"`. |
| `entry` | string \| null | — | Function name to call after eval (see Tool Styles below). `null` = standalone. |
| `needsSelection` | bool | — | Panel checks that ≥ 1 layer is selected before running. |
| `supportsCompOnly` | bool | — | Panel checks that the active item is a `CompItem`. |
| `destructive` | bool | — | If `true` and *Confirm Destructive* is ON, user gets a confirmation dialog. |
| `icon` | string \| null | — | Path relative to `CemToolbox/` root, e.g. `"icons/my_tool.png"`. |
| `version` | string | — | Displayed in tool details. |
| `tags` | string[] | — | Used in search / filter. |

---

## Tool Styles

### Style A — Standalone Script (`"entry": null`)

Everything at the top level of the file runs immediately when the panel
executes it, exactly as if the user ran the script from *File → Scripts*.

```jsx
// tools/my_standalone.jsx
alert("Hello from CemToolbox!");
```

The panel uses `$.evalFile(toolFile)` internally.

### Style B — Function Tool (`"entry": "run"`)

The file wraps its internals and exposes a public entry function.
The panel reads the file, wraps it in an IIFE to create a private scope,
captures the named function as a closure, then calls it.
This prevents symbol leakage into the panel's persistent engine.

```jsx
// tools/my_function_tool.jsx

// Private helpers — invisible outside
function _helper(x) { return x * 2; }

// Public entry — the panel calls this
function run() {
    var comp = app.project.activeItem;
    alert("Layers: " + comp.numLayers);
}
```

Manifest entry for Style B:
```json
{
  "script": "tools/my_function_tool.jsx",
  "entry":  "run"
}
```

---

## How to Add a New Tool (Quick Guide)

1. **Drop your `.jsx` file** into `CemToolbox/tools/`.

2. **Add an entry** to `CemToolbox/data/manifest.json`:
   ```json
   {
     "id":          "my_new_tool",
     "title":       "My New Tool",
     "description": "Does something great.",
     "category":    "Animation",
     "script":      "tools/my_new_tool.jsx",
     "entry":       null
   }
   ```

3. **Click Reload** in the panel top bar (enable *Dev Mode* in Settings to
   see the Reload button), or close and reopen the panel.

4. Your tool appears instantly under its category.

**Optional:** add a 32×32 PNG to `CemToolbox/icons/` and reference it with
`"icon": "icons/my_tool.png"` in the manifest.

---

## How to Add FFX Presets

1. Drop `.ffx` files into `CemToolbox/presets/`.
2. Subdirectories are scanned recursively — organise into folders freely.
3. Click **Reload** (Dev Mode) or reopen the panel.
4. Select **FFX Presets** in the sidebar.
5. Select layers in the active comp, then double-click a preset or press **Apply ▶**.

The panel uses AE's native `AVLayer.applyPreset(File)` API — no dialog.

---

## Settings & Persistence

Settings are stored in `CemToolbox/data/settings.json` (plain JSON, human-
readable and editable by hand if needed). The file is written on every change.

**Why a JSON file instead of `app.settings`?**
- `app.settings` is a flat key-value store per section; nesting requires manual
  serialisation anyway.
- The JSON file survives AE reinstalls, is version-controlled alongside your
  tools, and can be backed up or shared with a team.
- It's human-readable and easy to reset (just delete it).

| Setting | Default | Description |
|---|---|---|
| `devMode` | `false` | Shows the Reload button and mirrors log output to ESTK console. |
| `confirmDestructive` | `true` | Prompts before tools marked `"destructive": true`. |
| `lastCategory` | `"All Tools"` | Restores your last selected category on reopen. |
| `favorites.tools` | `[]` | Array of tool `id`s starred by the user. |
| `favorites.presets` | `[]` | Array of absolute preset file paths starred by the user. |
| `windowSize` | `{w:660,h:500}` | Reserved for future floating-window size restore. |

---

## Safety & Error Handling

- **Every tool run** is wrapped in `app.beginUndoGroup()` / `app.endUndoGroup()`
  so the entire operation is a single Cmd-Z in AE's history.
- **try/catch** around every tool execution; errors appear in the status bar
  and are written to `CemToolbox/data/log.txt`.
- **Preflight checks** run before the tool file is ever touched:
  - `supportsCompOnly: true` → active item must be a `CompItem`
  - `needsSelection: true` → active comp must have ≥ 1 selected layer
- **Log rotation:** `log.txt` is renamed to `log.txt.bak` when it exceeds
  512 KB; the previous `.bak` is deleted to keep disk usage bounded.
- Open the **Console** dialog (top-bar button) to view recent log lines
  without leaving AE.

---

## Troubleshooting

### Panel doesn't appear in Window menu
- Confirm `CemToolbox.jsx` is in `Scripts/ScriptUI Panels/` (not in `Scripts/` itself).
- After Effects must be restarted after placing the file.
- macOS Catalina+: check Gatekeeper / security quarantine on the file
  (`xattr -d com.apple.quarantine CemToolbox.jsx`).

### "Allow Scripts to Write Files" error on launch
- *Edit → Preferences → Scripting & Expressions → Allow Scripts to Write Files and Access Network*
- Without this, the panel cannot create `settings.json` or `log.txt`.

### Tools don't appear after editing manifest.json
- Use the **Reload** button (enable Dev Mode in Settings first).
- Check `log.txt` for JSON parse errors — even a trailing comma can break it.
- Validate your JSON at [jsonlint.com](https://jsonlint.com/).

### "Script file not found" error when running a tool
- Verify the `"script"` field in `manifest.json` is relative to the
  `CemToolbox/` root, e.g. `"tools/my_tool.jsx"` not an absolute path.
- Confirm the `.jsx` file actually exists at that path.

### Preset apply fails silently
- `AVLayer.applyPreset()` requires the layer type to be compatible with the preset.
  For example, a text preset on a solid layer will fail.
- Check `log.txt` for the specific AE error message.

### Panel is blank / grey after update
- The `#targetengine "CemToolbox"` directive keeps engine state between reloads.
  If you update `CemToolbox.jsx` while AE is open, fully restart AE to clear
  the stale engine.

---

## Known Limitations

| Limitation | Reason / Workaround |
|---|---|
| ScriptUI has no CSS styling | Spacing and alignment are used for visual hierarchy. Bold fonts attempted via `ScriptUI.newFont()`. |
| No card/grid layout for tools | ScriptUI only supports list-style UI. A 2-column `ListBox` is used instead. |
| Icon images not rendered in list | ScriptUI `ListBox` items don't support embedded images; initials are shown instead. Icon field reserved for future CEP/UXP port. |
| No async execution | ExtendScript is single-threaded. Long-running tools will freeze AE UI. Split large tools into stages or use `app.scheduleTask()`. |
| `$.evalFile()` runs in engine scope | Standalone tools can define globals that persist in the `"CemToolbox"` engine. Prefer function-style tools for cleaner isolation. |
| `applyPreset()` dialog-less only | AE < 2019 may show a preset-compatibility warning dialog on some layer types even with the scripting API. |
| Favourite preset paths are absolute | If you move the `CemToolbox/` folder, preset favourites will break. Tool favourites (by `id`) are location-independent. |

---

## Versioning

- The panel version is defined in the `CT.VERSION` constant at the top of
  `CemToolbox.jsx`.
- Each tool entry has its own `"version"` field in `manifest.json`.
- Recommended workflow: treat `manifest.json` and the `tools/` folder as
  a unit, commit them together, and bump versions in sync.

---

## Contributing / Extending

The panel is intentionally structured as internal ES3-compatible modules
(`Paths`, `Storage`, `Logger`, `Manifest`, `PresetMgr`, `ToolRunner`, `UI`)
inside a single IIFE so the code is easy to audit and extend without needing
a build system.

To add a new UI section (e.g. a "Recent Tools" list), follow the pattern of
the existing `toolsView` / `presetsView` groups in Section 13 of
`CemToolbox.jsx`.

---

*CemToolbox — built for fast, frictionless AE scripting workflows.*
