/*
    CameraFocusNull_v02.jsx
    Creates a 3D null named "FOCUS" and links it to the active camera's
    Focus Distance so you can move the null to set the focal point in 3D space.
    If the comp has no camera, one is created automatically.

    Author: Cem / nightowl
    Usage: Run from File > Scripts > Run Script File
*/

(function () {
    app.beginUndoGroup("Create Camera Focus Null");

    try {
        var comp = app.project.activeItem;

        if (!(comp && comp instanceof CompItem)) {
            alert("Please select a composition first.");
            return;
        }

        // ─── Find or Create Camera ───
        var cam = comp.activeCamera;

        if (!cam) {
            // Search for an existing camera layer
            for (var i = 1; i <= comp.numLayers; i++) {
                if (comp.layer(i) instanceof CameraLayer) {
                    cam = comp.layer(i);
                    break;
                }
            }
        }

        if (!cam) {
            // No camera exists — create one
            cam = comp.layers.addCamera("Camera 1", [comp.width / 2, comp.height / 2]);
        }

        // ─── Create FOCUS Null ───
        var focusNull = comp.layers.addNull();
        focusNull.name = "FOCUS";
        focusNull.threeDLayer = true;
        focusNull.label = 14; // cyan

        // Set anchor point to centre of the null (50 × 50 solid)
        focusNull.property("Anchor Point").setValue([50, 50, 0]);

        // Position the null at the camera's Point of Interest
        var poi = cam.property("Point of Interest").value;
        focusNull.property("Position").setValue(poi);

        // ─── Link Camera Focus Distance to Null ───
        var camOptions = cam.property("ADBE Camera Options Group");

        // Enable Depth of Field so focus distance is meaningful
        camOptions.property("ADBE Camera Depth of Field").setValue(1);

        // Expression: focus distance = distance between camera and FOCUS null
        camOptions.property("ADBE Camera Focus Distance").expression =
            'length(toWorld(transform.position), thisComp.layer("FOCUS").toWorld(thisComp.layer("FOCUS").transform.position))';

        // ─── Final Setup ───
        focusNull.selected = true;
        cam.selected = false;

        alert('Camera focus null created!\n\nMove the "FOCUS" null to set the focal point for "' + cam.name + '".');

    } catch (err) {
        alert("Error: " + err.toString());
    }

    app.endUndoGroup();
})();
