/*
    CameraRig.jsx
    Dockable ScriptUI panel — creates a full camera rig in After Effects.

    * "Camera Controller" null with slider / checkbox / angle / 3D-point controls
    * Two-node camera with every property driven by expressions
      pointing back to the controller

    Author: Cem / nightowl
    Install: Copy to  File > Scripts > ScriptUI Panels  then restart AE.
             Or run via  File > Scripts > Run Script File.
*/

(function (thisObj) {

    // ═══════════════════════════════════════
    //  UI
    // ═══════════════════════════════════════

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Camera Rig", undefined, { resizeable: true });

        win.orientation    = "column";
        win.alignChildren  = ["fill", "center"];
        win.spacing  = 8;
        win.margins  = 12;

        var btn = win.add("button", undefined, "Create Camera Rig");
        btn.preferredSize = [180, 36];
        btn.onClick = function () { createRig(); };

        if (win instanceof Window) { win.center(); win.show(); }
        else { win.layout.layout(true); }

        return win;
    }

    // ═══════════════════════════════════════
    //  RIG BUILDER
    // ═══════════════════════════════════════

    function createRig() {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            alert("Please select a composition first.");
            return;
        }

        app.beginUndoGroup("Create Camera Rig");

        try {
            // ─── Create Camera ───
            var cam = comp.layers.addCamera("Rig Camera",
                                            [comp.width / 2, comp.height / 2]);
            var camOpts = cam.property("ADBE Camera Options Group");

            // ─── Create Controller Null ───
            var ctrl = comp.layers.addNull();
            ctrl.name        = "Camera Controller";
            ctrl.label       = 11;   // yellow
            ctrl.threeDLayer = true;
            ctrl.shy         = false;

            var fx = ctrl.property("ADBE Effect Parade");

            // ─── Helpers ───
            function addSlider(name, val) {
                var e = fx.addProperty("ADBE Slider Control");
                e.name = name;
                e.property("Slider").setValue(val);
            }

            function addCheckbox(name, val) {
                var e = fx.addProperty("ADBE Checkbox Control");
                e.name = name;
                e.property("Checkbox").setValue(val ? 1 : 0);
            }

            function addPoint3D(name, val) {
                var e = fx.addProperty("ADBE Point3D Control");
                e.name = name;
                e.property("3D Point").setValue(val);
            }

            function addAngle(name, val) {
                var e = fx.addProperty("ADBE Angle Control");
                e.name = name;
                e.property("Angle").setValue(val);
            }

            // ═══════════════════════════════════════
            //  TRANSFORM CONTROLS
            // ═══════════════════════════════════════
            addPoint3D("Position",          [comp.width / 2, comp.height / 2, -1500]);
            addPoint3D("Point of Interest", [comp.width / 2, comp.height / 2, 0]);
            addAngle("X Rotation", 0);
            addAngle("Y Rotation", 0);
            addAngle("Z Rotation", 0);

            // ═══════════════════════════════════════
            //  CAMERA OPTION CONTROLS
            // ═══════════════════════════════════════
            addSlider("Zoom",           camOpts.property("ADBE Camera Zoom").value);
            addCheckbox("Depth of Field", false);
            addSlider("Focus Distance", camOpts.property("ADBE Camera Focus Distance").value);
            addSlider("Aperture",       50);
            addSlider("Blur Level",     100);

            // ─── Iris ───
            addSlider("Iris Shape",              7);
            addSlider("Iris Roundness",          0);
            addAngle("Iris Rotation",            0);
            addSlider("Iris Diffraction Fringe", 0);

            // ─── Highlights ───
            addSlider("Highlight Gain",       0);
            addSlider("Highlight Threshold",  1);
            addSlider("Highlight Saturation", 1);

            // ═══════════════════════════════════════
            //  EXPRESSION LINKING
            // ═══════════════════════════════════════
            var ref = 'thisComp.layer("Camera Controller")';

            // --- Transform ---
            cam.property("Position").expression =
                ref + '.effect("Position")("3D Point")';

            cam.property("Point of Interest").expression =
                ref + '.effect("Point of Interest")("3D Point")';

            cam.property("Orientation").expression =
                '[' + ref + '.effect("X Rotation")("Angle"),' +
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

            // ─── Final Setup ───
            cam.locked   = true;
            ctrl.selected = true;
            cam.selected  = false;

            alert("Camera Rig created!\n\nUse the 'Camera Controller' null to drive the camera.");

        } catch (err) {
            alert("Error: " + err.toString());
        }

        app.endUndoGroup();
    }

    // ─── Launch ───
    buildUI(thisObj);

})(this);
