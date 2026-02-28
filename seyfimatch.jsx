/*
    seyfimatch.jsx
    Matches position and rotation of one 3D layer to another.
    Select the layer to move first, then the target layer.
    Resolves parenting and expressions on the target.

    Author: syfpsy
    Usage: Run from File > Scripts > Run Script File
*/

(function () {
    app.beginUndoGroup("SeyfiMatch");

    try {
        var comp = app.project.activeItem;

        if (!(comp && comp instanceof CompItem)) {
            alert("SeyfiMatch: Open a composition first.");
            return;
        }

        var sel = comp.selectedLayers;

        if (sel.length !== 2) {
            alert("SeyfiMatch: Select exactly 2 layers.\n" +
                  "First select the layer to move, then the target.");
            return;
        }

        var source = sel[0]; // layer to move
        var target = sel[1]; // target reference

        // Ensure source is 3D
        if (!source.threeDLayer) source.threeDLayer = true;

        var t = comp.time;

        // ─── Temp Null for Expression Sampling ───
        var temp = comp.layers.addNull();
        temp.threeDLayer = true;
        temp.enabled = false;

        // Indices auto-update after adding the temp null
        var tIdx = target.index;
        var pIdx = source.parent ? source.parent.index : 0;

        function evalExpr(expr) {
            temp.property("Position").expression = expr;
            return temp.property("Position").valueAtTime(t, false);
        }

        // ═══════════════════════════════════════
        //  WORLD POSITION → SOURCE LOCAL POSITION
        // ═══════════════════════════════════════
        var newPos;

        if (source.parent) {
            newPos = evalExpr(
                'var T=thisComp.layer(' + tIdx + ');' +
                'var P=thisComp.layer(' + pIdx + ');' +
                'P.fromWorld(T.toWorld(T.transform.anchorPoint))'
            );
        } else {
            newPos = evalExpr(
                'var T=thisComp.layer(' + tIdx + ');' +
                'T.toWorld(T.transform.anchorPoint)'
            );
        }

        // ═══════════════════════════════════════
        //  WORLD ROTATION → SOURCE LOCAL ROTATION
        // ═══════════════════════════════════════
        var rotPre, rotSuf;

        if (source.parent) {
            rotPre = 'var T=thisComp.layer(' + tIdx + ');' +
                     'var P=thisComp.layer(' + pIdx + ');' +
                     'normalize(P.fromWorldVec(T.toWorldVec(';
            rotSuf = ')))';
        } else {
            rotPre = 'var T=thisComp.layer(' + tIdx + ');' +
                     'normalize(T.toWorldVec(';
            rotSuf = '))';
        }

        var xAxis = evalExpr(rotPre + '[1,0,0]' + rotSuf);
        var yAxis = evalExpr(rotPre + '[0,1,0]' + rotSuf);
        var zAxis = evalExpr(rotPre + '[0,0,1]' + rotSuf);

        // ─── Decompose Rotation Matrix → Euler (Rz · Ry · Rx) ───
        var D = 180 / Math.PI;
        var sinB = Math.max(-1, Math.min(1, -xAxis[2]));
        var yRot = Math.asin(sinB) * D;
        var xRot, zRot;

        if (Math.abs(sinB) < 0.99999) {
            xRot = Math.atan2(yAxis[2], zAxis[2]) * D;
            zRot = Math.atan2(xAxis[1], xAxis[0]) * D;
        } else {
            // Gimbal lock
            xRot = 0;
            zRot = Math.atan2(-yAxis[0], yAxis[1]) * D;
        }

        // ─── Remove Temp Null ───
        temp.remove();

        // ═══════════════════════════════════════
        //  APPLY TO SOURCE
        // ═══════════════════════════════════════
        function clearExpr(prop) {
            try {
                if (prop && prop.expressionEnabled) prop.expression = "";
            } catch (e) {}
        }

        // Clear expressions on matched properties
        clearExpr(source.property("Orientation"));
        clearExpr(source.property("X Rotation"));
        clearExpr(source.property("Y Rotation"));
        clearExpr(source.property("Z Rotation"));

        // Set position (handle separated dimensions)
        var posProp = source.property("Position");

        if (posProp.dimensionsSeparated) {
            clearExpr(source.property("X Position"));
            clearExpr(source.property("Y Position"));
            clearExpr(source.property("Z Position"));
            source.property("X Position").setValue(newPos[0]);
            source.property("Y Position").setValue(newPos[1]);
            source.property("Z Position").setValue(newPos[2]);
        } else {
            clearExpr(posProp);
            posProp.setValue(newPos);
        }

        // Set rotation: clear Orientation, use individual X/Y/Z Rotation
        source.property("Orientation").setValue([0, 0, 0]);
        source.property("X Rotation").setValue(xRot);
        source.property("Y Rotation").setValue(yRot);
        source.property("Z Rotation").setValue(zRot);

    } catch (err) {
        try { temp.remove(); } catch (e) {}
        alert("SeyfiMatch Error:\n" + err.toString());
    }

    app.endUndoGroup();
})();
