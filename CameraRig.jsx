/*
    CameraRig.jsx  –  Standalone camera rig builder (null-first)
    ─────────────────────────────────────────────────────────────
    Creates:  CAM_CTRL  (controller null + all camera option sliders)
              CAM_TARGET (point-of-interest null)
              CAM_01     (camera, parented to CAM_CTRL)

    Author: Cem / nightowl
    Usage:  File > Scripts > Run Script File
            — or install in ScriptUI Panels for a click-button panel.
*/
(function (thisObj) {

    // ── UI ──────────────────────────────────────────────────────
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Camera Rig", undefined, { resizeable: true });
        win.orientation   = "column";
        win.alignChildren = ["fill", "center"];
        win.spacing = 8;  win.margins = 12;

        var btn = win.add("button", undefined, "Create Camera Rig");
        btn.preferredSize = [180, 36];
        btn.onClick = function () { createRig(); };

        if (win instanceof Window) { win.center(); win.show(); }
        else { win.layout.layout(true); }
    }

    // ── RIG BUILDER ─────────────────────────────────────────────
    function createRig() {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            alert("Select an active composition first."); return;
        }

        app.beginUndoGroup("Create Camera Rig");
        try {
            var cx = comp.width / 2, cy = comp.height / 2;

            // ── 1. CONTROL NULL (first, stays on top) ─────────────
            var ctrl = comp.layers.addNull();
            ctrl.name        = "CAM_CTRL";
            ctrl.label       = 11;          // gold
            ctrl.threeDLayer = true;
            ctrl.property("ADBE Transform Group")
                .property("ADBE Position").setValue([cx, cy, 0]);
            ctrl.moveToBeginning();

            // ── 2. TARGET NULL ────────────────────────────────────
            var target = comp.layers.addNull();
            target.name        = "CAM_TARGET";
            target.label       = 2;         // red
            target.threeDLayer = true;
            target.property("ADBE Transform Group")
                  .property("ADBE Position").setValue([cx, cy, 0]);
            target.moveAfter(ctrl);

            // ── 3. CAMERA (created AFTER nulls) ──────────────────
            var cam = comp.layers.addCamera("CAM_01", [cx, cy]);
            cam.autoOrient = AutoOrientType.NO_AUTO_ORIENT;
            cam.moveAfter(target);

            // ── 4. Parent camera → ctrl ──────────────────────────
            cam.parent = ctrl;
            try {
                var camPos = cam.property("ADBE Transform Group")
                               .property("ADBE Position");
                if (Math.abs(camPos.value[2]) < 1)
                    camPos.setValue([0, 0, -2000]);
            } catch (e) {}

            // ── 5. POI → target (AFTER target exists) ────────────
            cam.property("ADBE Transform Group")
               .property("ADBE Point of Interest")
               .expression = 'thisComp.layer("CAM_TARGET").transform.position;';

            // ── 6. Add camera option sliders to ctrl ──────────────
            var camOpts = cam.property("ADBE Camera Options Group");
            var fx = ctrl.property("ADBE Effect Parade");

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
            function addAngle(name, val) {
                var e = fx.addProperty("ADBE Angle Control");
                e.name = name;
                e.property("Angle").setValue(val);
            }

            // Camera Options
            addSlider("Zoom",           camOpts.property("ADBE Camera Zoom").value);
            addCheckbox("Depth of Field", false);
            addSlider("Focus Distance", camOpts.property("ADBE Camera Focus Distance").value);
            addSlider("Aperture",       50);
            addSlider("Blur Level",     100);
            // Iris
            addSlider("Iris Shape",              7);
            addSlider("Iris Roundness",          0);
            addAngle("Iris Rotation",            0);
            addSlider("Iris Diffraction Fringe", 0);
            // Highlights
            addSlider("Highlight Gain",       0);
            addSlider("Highlight Threshold",  1);
            addSlider("Highlight Saturation", 1);

            // ── 7. Link camera options → sliders ─────────────────
            var ref = 'thisComp.layer("CAM_CTRL")';
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
            camOpts.property("ADBE Iris Shape").expression =
                ref + '.effect("Iris Shape")("Slider")';
            camOpts.property("ADBE Iris Roundness").expression =
                ref + '.effect("Iris Roundness")("Slider")';
            camOpts.property("ADBE Iris Rotation").expression =
                ref + '.effect("Iris Rotation")("Angle")';
            camOpts.property("ADBE Iris Diffraction Fringe").expression =
                ref + '.effect("Iris Diffraction Fringe")("Slider")';
            camOpts.property("ADBE Iris Highlight Gain").expression =
                ref + '.effect("Highlight Gain")("Slider")';
            camOpts.property("ADBE Iris Highlight Threshold").expression =
                ref + '.effect("Highlight Threshold")("Slider")';
            camOpts.property("ADBE Iris Highlight Saturation").expression =
                ref + '.effect("Highlight Saturation")("Slider")';

            // ── Final ─────────────────────────────────────────────
            cam.locked    = true;
            ctrl.selected = true;
            cam.selected  = false;
            alert("Camera Rig created!\n\nMove CAM_CTRL to orbit. Move CAM_TARGET to aim.\nAll camera options are sliders on CAM_CTRL.");

        } catch (err) { alert("Error: " + err); }
        app.endUndoGroup();
    }

    buildUI(thisObj);
})(this);
