/**
 * hello_world.jsx
 * =============================================================================
 * CemToolbox — Example Tool A: STANDALONE SCRIPT
 *
 * Tool style: Standalone (no entry function).
 * The panel executes this via $.evalFile(), so everything at the top level
 * runs immediately — just like the user running it from File > Scripts.
 *
 * Manifest entry:
 *   "script": "tools/hello_world.jsx"
 *   "entry":  null          <-- tells the panel to use standalone mode
 * =============================================================================
 */

(function helloWorld() {
    "use strict";

    // Gather some friendly info about the current AE session
    var aeVersion   = app.version;
    var projectName = (app.project && app.project.file)
        ? app.project.file.name
        : "(untitled project)";

    var activeComp  = app.project.activeItem;
    var compInfo    = (activeComp instanceof CompItem)
        ? "Active comp: \"" + activeComp.name + "\"  (" +
          activeComp.width + " x " + activeComp.height + " @ " +
          activeComp.frameRate.toFixed(2) + " fps)"
        : "No active composition.";

    var msg = [
        "Hello from CemToolbox!",
        "",
        "After Effects version : " + aeVersion,
        "Project               : " + projectName,
        compInfo,
        "",
        "This is Example Tool A — a standalone .jsx script.",
        "Drop your own .jsx files into CemToolbox/tools/ and",
        "register them in CemToolbox/data/manifest.json."
    ].join("\n");

    alert(msg, "CemToolbox — Hello World");
}());
