/*
    syfcam.jsx
    After Effects Camera Rig Script

    Creates a fully controllable camera rig:
    - "syfcam Controller" null with slider/checkbox/point controls
    - A two-node camera with every property driven by expressions
      pointing back to the controller null

    Usage:
    - Dockable panel:  File > Scripts > ScriptUI Panels > syfcam.jsx
    - One-shot:        File > Scripts > Run Script File
*/

var syfcam = (function () {

    // ─── Core rig builder ───────────────────────────────────────
    function buildRig() {
        app.beginUndoGroup("syfcam – Create Camera Rig");

        try {
            var comp = app.project.activeItem;

            if (!(comp && comp instanceof CompItem)) {
                alert("syfcam: Please select a composition first.");
                return;
            }

            var cw = comp.width;
            var ch = comp.height;

            // ═══════════════════════════════════════
            //  CREATE CAMERA
            // ═══════════════════════════════════════
            var cam = comp.layers.addCamera(
                "syfcam",
                [cw / 2, ch / 2]
            );
            var camOpts = cam.property("ADBE Camera Options Group");

            // ═══════════════════════════════════════
            //  CREATE CONTROLLER NULL
            // ═══════════════════════════════════════
            var ctrl = comp.layers.addNull();
            ctrl.name = "syfcam Controller";
            ctrl.label = 11; // yellow
            ctrl.threeDLayer = true;

            var fx = ctrl.property("ADBE Effect Parade");

            // ─── Helpers ────────────────────────────

            function addSlider(name, val) {
                var e = fx.addProperty("ADBE Slider Control");
                e.name = name;
                e.property("Slider").setValue(val);
                return e;
            }

            function addCheckbox(name, val) {
                var e = fx.addProperty("ADBE Checkbox Control");
                e.name = name;
                e.property("Checkbox").setValue(val ? 1 : 0);
                return e;
            }

            function addPoint3D(name, val) {
                var e = fx.addProperty("ADBE Point3D Control");
                e.name = name;
                e.property("3D Point").setValue(val);
                return e;
            }

            function addAngle(name, val) {
                var e = fx.addProperty("ADBE Angle Control");
                e.name = name;
                e.property("Angle").setValue(val);
                return e;
            }

            function addDropdown(name, items, defaultIdx) {
                var e = fx.addProperty("ADBE Dropdown Control");
                e.name = name;
                var prop = e.property("Menu");
                // After Effects CC 2019+ supports setPropertyParameters
                // For older versions the dropdown will have a single default item
                try {
                    prop.setPropertyParameters(items);
                    prop.setValue(defaultIdx);
                } catch (_) {
                    // Fallback: leave as default single-item dropdown
                }
                return e;
            }

            // ═══════════════════════════════════════
            //  TRANSFORM CONTROLS
            // ═══════════════════════════════════════
            addPoint3D("Position",          [cw / 2, ch / 2, -1500]);
            addPoint3D("Point of Interest",  [cw / 2, ch / 2, 0]);
            addAngle("X Rotation", 0);
            addAngle("Y Rotation", 0);
            addAngle("Z Rotation", 0);

            // ═══════════════════════════════════════
            //  CAMERA OPTION CONTROLS
            // ═══════════════════════════════════════

            // --- Lens ---
            var zoomDefault = camOpts.property("ADBE Camera Zoom").value;
            addSlider("Zoom", zoomDefault);

            // --- Depth of Field ---
            addCheckbox("Depth of Field", false);

            var focusDefault = camOpts.property("ADBE Camera Focus Distance").value;
            addSlider("Focus Distance", focusDefault);
            addSlider("Aperture",        50);
            addSlider("Blur Level",      100);

            // --- Iris ---
            addSlider("Iris Shape",              7);
            addSlider("Iris Roundness",          0);
            addAngle("Iris Rotation",            0);
            addSlider("Iris Diffraction Fringe", 0);

            // --- Highlight ---
            addSlider("Highlight Gain",        0);
            addSlider("Highlight Threshold",   1);
            addSlider("Highlight Saturation",  1);

            // ═══════════════════════════════════════
            //  EXPRESSION LINKING
            // ═══════════════════════════════════════
            var ref = 'thisComp.layer("syfcam Controller")';

            // --- Transform ---
            cam.property("Position").expression =
                ref + '.effect("Position")("3D Point")';

            cam.property("Point of Interest").expression =
                ref + '.effect("Point of Interest")("3D Point")';

            cam.property("Orientation").expression =
                '[' +
                ref + '.effect("X Rotation")("Angle"),' +
                ref + '.effect("Y Rotation")("Angle"),' +
                ref + '.effect("Z Rotation")("Angle")]';

            // --- Camera Options ---
            camOpts.property("ADBE Camera Zoom").expression =
                ref + '.effect("Zoom")("Slider")';

            camOpts.property("ADBE Camera Depth of Field").expression =
                ref + '.effect("Depth of Field")("Checkbox")';

            camOpts.property("ADBE Camera Focus Distance").expression =
                ref + '.effect("Focus Distance")("Slider")';

            camOpts.property("ADBE Camera Aperture").expression =
                ref + '.effect("Aperture")("Slider")';

            camOpts.property("ADBE Camera Blur Level").expression =
                ref + '.effect("Blur Level")("Slider")';

            // --- Iris ---
            camOpts.property("ADBE Iris Shape").expression =
                ref + '.effect("Iris Shape")("Slider")';

            camOpts.property("ADBE Iris Roundness").expression =
                ref + '.effect("Iris Roundness")("Slider")';

            camOpts.property("ADBE Iris Rotation").expression =
                ref + '.effect("Iris Rotation")("Angle")';

            camOpts.property("ADBE Iris Diffraction Fringe").expression =
                ref + '.effect("Iris Diffraction Fringe")("Slider")';

            // --- Highlights ---
            camOpts.property("ADBE Iris Highlight Gain").expression =
                ref + '.effect("Highlight Gain")("Slider")';

            camOpts.property("ADBE Iris Highlight Threshold").expression =
                ref + '.effect("Highlight Threshold")("Slider")';

            camOpts.property("ADBE Iris Highlight Saturation").expression =
                ref + '.effect("Highlight Saturation")("Slider")';

            // ═══════════════════════════════════════
            //  FINAL SETUP
            // ═══════════════════════════════════════
            cam.parent = ctrl;   // parent camera to null for easy repositioning
            cam.locked = true;   // prevent accidental edits on the camera layer
            cam.shy = true;      // hide camera in timeline when shy is enabled

            ctrl.selected = true;
            cam.selected = false;

        } catch (err) {
            alert("syfcam error:\n" + err.toString());
        }

        app.endUndoGroup();
    }

    // ─── UI builder ─────────────────────────────────────────────
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "syfcam", undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 12;

        // Title
        var title = win.add("statictext", undefined, "syfcam");
        title.alignment = ["center", "top"];
        title.graphics.font = ScriptUI.newFont("dialog", "BOLD", 14);

        // Create Rig button
        var btn = win.add("button", undefined, "Create Camera Rig");
        btn.preferredSize = [180, 36];
        btn.onClick = buildRig;

        // Layout for palette windows
        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
            win.layout.resize();
        }

        return win;
    }

    return buildUI(this);

}).call(this);
