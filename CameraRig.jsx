/*
    CameraRig.jsx
    Creates a camera rig in After Effects:
    - A "Camera Controller" null layer with slider/checkbox controls
    - A two-node camera linked to the null via expressions
    
    Author: Cem / nightowl
    Usage: Run from File > Scripts > Run Script File
*/

(function () {
    app.beginUndoGroup("Create Camera Rig");

    try {
        var comp = app.project.activeItem;

        if (!(comp && comp instanceof CompItem)) {
            alert("Please select a composition first.");
            return;
        }

        // ─── Create Camera ───
        var cam = comp.layers.addCamera("Rig Camera", [comp.width / 2, comp.height / 2]);
        var camOptions = cam.property("ADBE Camera Options Group");

        // ─── Create Controller Null ───
        var ctrl = comp.layers.addNull();
        ctrl.name = "Camera Controller";
        ctrl.label = 11; // yellow
        ctrl.threeDLayer = true;
        ctrl.shy = false;

        var fx = ctrl.property("ADBE Effect Parade");

        // ─── Helper: Add Slider Control ───
        function addSlider(name, defaultVal) {
            var e = fx.addProperty("ADBE Slider Control");
            e.name = name;
            e.property("Slider").setValue(defaultVal);
            return e;
        }

        // ─── Helper: Add Checkbox Control ───
        function addCheckbox(name, defaultVal) {
            var e = fx.addProperty("ADBE Checkbox Control");
            e.name = name;
            e.property("Checkbox").setValue(defaultVal ? 1 : 0);
            return e;
        }

        // ─── Helper: Add Point Control (3D) ───
        function addPoint3D(name, defaultVal) {
            var e = fx.addProperty("ADBE Point3D Control");
            e.name = name;
            e.property("3D Point").setValue(defaultVal);
            return e;
        }

        // ═══════════════════════════════════════
        //  TRANSFORM CONTROLS
        // ═══════════════════════════════════════
        addPoint3D("Position", [comp.width / 2, comp.height / 2, -1500]);
        addPoint3D("Point of Interest", [comp.width / 2, comp.height / 2, 0]);
        addSlider("X Rotation", 0);
        addSlider("Y Rotation", 0);
        addSlider("Z Rotation", 0);

        // ═══════════════════════════════════════
        //  CAMERA OPTION CONTROLS
        // ═══════════════════════════════════════
        var zoomDefault = camOptions.property("ADBE Camera Zoom").value;
        addSlider("Zoom", zoomDefault);

        var dofDefault = 0;
        addCheckbox("Depth of Field", false);

        var focusDefault = camOptions.property("ADBE Camera Focus Distance").value;
        addSlider("Focus Distance", focusDefault);

        addSlider("Aperture", 50);
        addSlider("Blur Level", 100);

        // Iris properties
        addSlider("Iris Shape", 7);        // sides (default round = 7+)
        addSlider("Iris Roundness", 0);
        addSlider("Iris Rotation", 0);
        addSlider("Iris Diffraction Fringe", 0);

        // Highlight
        addSlider("Highlight Gain", 0);
        addSlider("Highlight Threshold", 1);
        addSlider("Highlight Saturation", 1);

        // ═══════════════════════════════════════
        //  EXPRESSION LINKING
        // ═══════════════════════════════════════

        var ctrlIdx = ctrl.index;
        var ctrlRef = 'thisComp.layer("Camera Controller")';

        // --- Transform ---
        cam.property("Position").expression =
            ctrlRef + '.effect("Position")("3D Point")';

        cam.property("Point of Interest").expression =
            ctrlRef + '.effect("Point of Interest")("3D Point")';

        cam.property("Orientation").expression =
            '[' + ctrlRef + '.effect("X Rotation")("Slider"),' +
            ctrlRef + '.effect("Y Rotation")("Slider"),' +
            ctrlRef + '.effect("Z Rotation")("Slider")]';

        // --- Camera Options ---
        camOptions.property("ADBE Camera Zoom").expression =
            ctrlRef + '.effect("Zoom")("Slider")';

        camOptions.property("ADBE Camera Focus Distance").expression =
            ctrlRef + '.effect("Focus Distance")("Slider")';

        camOptions.property("ADBE Camera Aperture").expression =
            ctrlRef + '.effect("Aperture")("Slider")';

        camOptions.property("ADBE Camera Blur Level").expression =
            ctrlRef + '.effect("Blur Level")("Slider")';

        // Depth of Field (checkbox → on/off)
        camOptions.property("ADBE Camera Depth of Field").expression =
            ctrlRef + '.effect("Depth of Field")("Checkbox")';

        // Iris
        camOptions.property("ADBE Iris Shape").expression =
            ctrlRef + '.effect("Iris Shape")("Slider")';

        camOptions.property("ADBE Iris Roundness").expression =
            ctrlRef + '.effect("Iris Roundness")("Slider")';

        camOptions.property("ADBE Iris Rotation").expression =
            ctrlRef + '.effect("Iris Rotation")("Slider")';

        camOptions.property("ADBE Iris Diffraction Fringe").expression =
            ctrlRef + '.effect("Iris Diffraction Fringe")("Slider")';

        // Highlights
        camOptions.property("ADBE Iris Highlight Gain").expression =
            ctrlRef + '.effect("Highlight Gain")("Slider")';

        camOptions.property("ADBE Iris Highlight Threshold").expression =
            ctrlRef + '.effect("Highlight Threshold")("Slider")';

        camOptions.property("ADBE Iris Highlight Saturation").expression =
            ctrlRef + '.effect("Highlight Saturation")("Slider")';

        // ─── Final Setup ───
        cam.locked = true;
        ctrl.selected = true;
        cam.selected = false;

        alert("Camera Rig created!\n\nUse the 'Camera Controller' null to control everything.");

    } catch (err) {
        alert("Error: " + err.toString());
    }

    app.endUndoGroup();
})();
