/**
 * layer_renamer.jsx
 * =============================================================================
 * CemToolbox — Example Tool B: FUNCTION TOOL
 *
 * Tool style: Function tool — exposes a `run()` entry point.
 * The panel wraps the file in an IIFE, captures `run` as a closure,
 * then calls it. This keeps internal helpers private.
 *
 * Manifest entry:
 *   "script"          : "tools/layer_renamer.jsx"
 *   "entry"           : "run"    <-- panel calls this function
 *   "needsSelection"  : true     <-- panel pre-checks selection
 *   "supportsCompOnly": true     <-- panel pre-checks active comp
 * =============================================================================
 */

/* ---- private helpers (only visible inside the IIFE the panel creates) ---- */

/**
 * Build a new name from the original name plus optional prefix / suffix.
 * @param {string} original
 * @param {string} prefix
 * @param {string} suffix
 * @param {boolean} stripNumbers  Strip trailing digits like " 1", " 2" first.
 * @returns {string}
 */
function _buildName(original, prefix, suffix, stripNumbers) {
    var base = original;
    if (stripNumbers) {
        // Remove trailing space + digits (e.g. " 2", " 12")
        base = base.replace(/\s+\d+$/, "");
    }
    return prefix + base + suffix;
}

/**
 * Show a small dialog to gather rename parameters from the user.
 * @returns {{ ok:boolean, prefix:string, suffix:string, stripNumbers:boolean }}
 */
function _showDialog() {
    var dlg = new Window("dialog", "Layer Renamer");
    dlg.orientation   = "column";
    dlg.alignChildren = ["fill", "top"];
    dlg.spacing       = 10;
    dlg.margins       = 16;

    // ---- Prefix row ----
    var prefRow = dlg.add("group");
    prefRow.add("statictext", undefined, "Prefix:");
    prefRow.add("edittext",   undefined, "").preferredSize = [200, 22];
    var prefFld = prefRow.children[1];

    // ---- Suffix row ----
    var sufRow = dlg.add("group");
    sufRow.add("statictext", undefined, "Suffix:");
    sufRow.add("edittext",   undefined, "").preferredSize = [200, 22];
    var sufFld = sufRow.children[1];

    // ---- Strip trailing numbers ----
    var stripCb = dlg.add("checkbox", undefined,
        "Strip trailing numbers from original names before renaming");
    stripCb.value = false;

    // ---- Preview label ----
    var previewLbl = dlg.add("statictext", undefined, "Preview: (type prefix/suffix to preview)");
    previewLbl.alignment = ["fill", "top"];

    // Live preview update
    function updatePreview() {
        var comp = app.project.activeItem;
        if (!(comp instanceof CompItem) || !comp.selectedLayers || comp.selectedLayers.length === 0) {
            previewLbl.text = "Preview: (no selection)";
            return;
        }
        var firstName = comp.selectedLayers[0].name;
        var newName   = _buildName(firstName, prefFld.text, sufFld.text, stripCb.value);
        previewLbl.text = "Preview: \"" + firstName + "\"  \u2192  \"" + newName + "\"";
    }

    prefFld.onChanging  = updatePreview;
    sufFld.onChanging   = updatePreview;
    stripCb.onClick     = updatePreview;

    // ---- Buttons ----
    var btnRow = dlg.add("group");
    btnRow.alignment = ["right", "bottom"];
    var okBtn     = btnRow.add("button", undefined, "Rename",  { name: "ok"     });
    var cancelBtn = btnRow.add("button", undefined, "Cancel",  { name: "cancel" });

    okBtn.onClick     = function() { dlg.close(1); };
    cancelBtn.onClick = function() { dlg.close(0); };

    updatePreview();

    var result = dlg.show();
    return {
        ok           : result === 1,
        prefix       : prefFld.text,
        suffix       : sufFld.text,
        stripNumbers : stripCb.value
    };
}

/* ---- PUBLIC entry point — called by CemToolbox panel ---- */

/**
 * run()
 * Entry function invoked by CemToolbox after preflight checks pass.
 * At this point we are guaranteed:
 *   - An active CompItem exists
 *   - At least one layer is selected
 */
function run() {
    var params = _showDialog();
    if (!params.ok) { return; }  // user cancelled

    var comp   = app.project.activeItem;
    var layers = comp.selectedLayers;
    var renamed = 0;

    for (var i = 0; i < layers.length; i++) {
        var layer   = layers[i];
        var newName = _buildName(layer.name, params.prefix, params.suffix, params.stripNumbers);
        if (newName !== layer.name) {
            layer.name = newName;
            renamed++;
        }
    }

    alert(
        "Layer Renamer complete.\n\n" +
        "Renamed: " + renamed + " of " + layers.length + " selected layer(s).",
        "CemToolbox — Layer Renamer"
    );
}
