/*
    AfterTools.jsx  —  25 Tools + 25 Animation Presets in one dockable panel
    ──────────────────────────────────────────────────────────────────────────
    Install:  Copy to  File > Scripts > ScriptUI Panels  then restart AE.
              Or run via  File > Scripts > Run Script File.
    Author: Cem / nightowl
*/
(function (thisObj) {
"use strict";

// ════════════════════════════════════════════════════════════════
//  SHARED HELPERS
// ════════════════════════════════════════════════════════════════
function getComp() {
    var c = app.project.activeItem;
    if (!(c && c instanceof CompItem)) { alert("Select a composition first."); return null; }
    return c;
}
function getSel(comp, min) {
    var s = comp.selectedLayers;
    if (s.length < (min || 1)) { alert("Select at least " + (min || 1) + " layer(s)."); return null; }
    return s;
}
function undo(name, fn) {
    app.beginUndoGroup(name);
    try { fn(); } catch (e) { alert("Error: " + e); }
    app.endUndoGroup();
}
function addFx(layer, matchname, propName, val) {
    var e = layer.property("ADBE Effect Parade").addProperty(matchname);
    if (propName) e.property(propName).setValue(val);
    return e;
}
function slider(fx, name, val) {
    var e = fx.addProperty("ADBE Slider Control");
    e.name = name; e.property("Slider").setValue(val); return e;
}
function checkbox(fx, name, val) {
    var e = fx.addProperty("ADBE Checkbox Control");
    e.name = name; e.property("Checkbox").setValue(val ? 1 : 0); return e;
}
function angle(fx, name, val) {
    var e = fx.addProperty("ADBE Angle Control");
    e.name = name; e.property("Angle").setValue(val); return e;
}
function point3d(fx, name, val) {
    var e = fx.addProperty("ADBE Point3D Control");
    e.name = name; e.property("3D Point").setValue(val); return e;
}
function eachSelected(fn) {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp); if (!sel) return;
    undo(fn.name || "AfterTools", function () {
        for (var i = 0; i < sel.length; i++) { try { fn(sel[i], comp); } catch (e) { alert(e); } }
    });
}

// ════════════════════════════════════════════════════════════════
//  TOOLS  (25)
// ════════════════════════════════════════════════════════════════

// 1 ── Camera Rig (null-first, parented, slider-driven)
function toolCameraRig() {
    var comp = getComp(); if (!comp) return;
    undo("Camera Rig", function () {
        var cx = comp.width / 2, cy = comp.height / 2;

        // — CTRL null first —
        var ctrl = comp.layers.addNull();
        ctrl.name = "CAM_CTRL"; ctrl.label = 11; ctrl.threeDLayer = true;
        ctrl.property("ADBE Transform Group").property("ADBE Position").setValue([cx, cy, 0]);
        ctrl.moveToBeginning();

        // — TARGET null —
        var tgt = comp.layers.addNull();
        tgt.name = "CAM_TARGET"; tgt.label = 2; tgt.threeDLayer = true;
        tgt.property("ADBE Transform Group").property("ADBE Position").setValue([cx, cy, 0]);
        tgt.moveAfter(ctrl);

        // — CAMERA last —
        var cam = comp.layers.addCamera("CAM_01", [cx, cy]);
        cam.autoOrient = AutoOrientType.NO_AUTO_ORIENT;
        cam.moveAfter(tgt);
        cam.parent = ctrl;
        try {
            var cp = cam.property("ADBE Transform Group").property("ADBE Position");
            if (Math.abs(cp.value[2]) < 1) cp.setValue([0, 0, -2000]);
        } catch (e) {}
        cam.property("ADBE Transform Group").property("ADBE Point of Interest").expression =
            'thisComp.layer("CAM_TARGET").transform.position;';

        // — Sliders on CTRL —
        var co = cam.property("ADBE Camera Options Group");
        var fx = ctrl.property("ADBE Effect Parade");
        slider(fx, "Zoom",           co.property("ADBE Camera Zoom").value);
        checkbox(fx, "Depth of Field", false);
        slider(fx, "Focus Distance", co.property("ADBE Camera Focus Distance").value);
        slider(fx, "Aperture",       50);
        slider(fx, "Blur Level",     100);
        slider(fx, "Iris Shape",     7);
        slider(fx, "Iris Roundness", 0);
        angle(fx,  "Iris Rotation",  0);
        slider(fx, "Iris Diffraction Fringe", 0);
        slider(fx, "Highlight Gain",       0);
        slider(fx, "Highlight Threshold",  1);
        slider(fx, "Highlight Saturation", 1);

        // — Expressions —
        var r = 'thisComp.layer("CAM_CTRL")';
        co.property("ADBE Camera Zoom").expression              = r + '.effect("Zoom")("Slider")';
        co.property("ADBE Camera Depth of Field").expression    = r + '.effect("Depth of Field")("Checkbox")';
        co.property("ADBE Camera Focus Distance").expression    = r + '.effect("Focus Distance")("Slider")';
        co.property("ADBE Camera Aperture").expression          = r + '.effect("Aperture")("Slider")';
        co.property("ADBE Camera Blur Level").expression        = r + '.effect("Blur Level")("Slider")';
        co.property("ADBE Iris Shape").expression               = r + '.effect("Iris Shape")("Slider")';
        co.property("ADBE Iris Roundness").expression           = r + '.effect("Iris Roundness")("Slider")';
        co.property("ADBE Iris Rotation").expression            = r + '.effect("Iris Rotation")("Angle")';
        co.property("ADBE Iris Diffraction Fringe").expression  = r + '.effect("Iris Diffraction Fringe")("Slider")';
        co.property("ADBE Iris Highlight Gain").expression      = r + '.effect("Highlight Gain")("Slider")';
        co.property("ADBE Iris Highlight Threshold").expression = r + '.effect("Highlight Threshold")("Slider")';
        co.property("ADBE Iris Highlight Saturation").expression= r + '.effect("Highlight Saturation")("Slider")';

        cam.locked = true; ctrl.selected = true; cam.selected = false;
        alert("Camera Rig ready!\nMove CAM_CTRL to orbit.\nMove CAM_TARGET to aim.\nAll options on CAM_CTRL sliders.");
    });
}

// 2 ── Null Parent: parent selected layers to a new null
function toolNullParent() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp); if (!sel) return;
    undo("Null Parent", function () {
        var n = comp.layers.addNull(comp.duration);
        n.name = "Parent Null"; n.label = 2; n.threeDLayer = sel[0].threeDLayer;
        for (var i = 0; i < sel.length; i++) sel[i].parent = n;
        n.moveToBeginning(); n.selected = true;
    });
}

// 3 ── Wiggle Rig: controller null with freq/amp sliders
function toolWiggleRig() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp); if (!sel) return;
    undo("Wiggle Rig", function () {
        var ctrl = comp.layers.addNull();
        ctrl.name = "Wiggle Ctrl"; ctrl.label = 9; ctrl.threeDLayer = true;
        ctrl.moveToBeginning();
        var fx = ctrl.property("ADBE Effect Parade");
        slider(fx, "Freq X", 2); slider(fx, "Amp X", 50);
        slider(fx, "Freq Y", 2); slider(fx, "Amp Y", 50);
        slider(fx, "Freq Z", 0); slider(fx, "Amp Z", 0);
        var r = 'thisComp.layer("Wiggle Ctrl")';
        var expr = 'var f=[' + r + '.effect("Freq X")("Slider"),' + r + '.effect("Freq Y")("Slider"),' + r + '.effect("Freq Z")("Slider")];\n' +
                   'var a=[' + r + '.effect("Amp X")("Slider"),' + r + '.effect("Amp Y")("Slider"),' + r + '.effect("Amp Z")("Slider")];\n' +
                   '[wiggle(f[0],a[0])[0],wiggle(f[1],a[1])[1],wiggle(f[2],a[2])[2]]';
        for (var i = 0; i < sel.length; i++) sel[i].property("Position").expression = expr;
    });
}

// 4 ── Sequence Layers end-to-end
function toolSequenceLayers() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp, 2); if (!sel) return;
    undo("Sequence Layers", function () {
        var sorted = sel.slice().sort(function (a, b) { return a.index - b.index; });
        var t = sorted[0].inPoint;
        for (var i = 0; i < sorted.length; i++) {
            var dur = sorted[i].outPoint - sorted[i].inPoint;
            sorted[i].startTime = t; t += dur;
        }
    });
}

// 5 ── Distribute Layers evenly (vertically)
function toolDistributeLayers() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp, 3); if (!sel) return;
    undo("Distribute Layers", function () {
        var sorted = sel.slice().sort(function (a, b) {
            return a.property("Position").value[1] - b.property("Position").value[1];
        });
        var top = sorted[0].property("Position").value[1];
        var bot = sorted[sorted.length - 1].property("Position").value[1];
        var step = (bot - top) / (sorted.length - 1);
        for (var i = 1; i < sorted.length - 1; i++) {
            var p = sorted[i].property("Position").value;
            sorted[i].property("Position").setValue([p[0], top + step * i, p[2] || 0]);
        }
    });
}

// 6 ── Auto Null All (parent every non-camera/light layer to its own null)
function toolAutoNullAll() {
    var comp = getComp(); if (!comp) return;
    undo("Auto Null All", function () {
        var layers = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!(l instanceof CameraLayer) && !(l instanceof LightLayer)) layers.push(l);
        }
        for (var j = 0; j < layers.length; j++) {
            var n = comp.layers.addNull(comp.duration);
            n.name = layers[j].name + " NULL"; n.label = 10; n.threeDLayer = layers[j].threeDLayer;
            layers[j].parent = n;
        }
    });
}

// 7 ── Split at Playhead
function toolSplitAtPlayhead() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp); if (!sel) return;
    undo("Split Layers", function () {
        var t = comp.time;
        for (var i = 0; i < sel.length; i++)
            if (t > sel[i].inPoint && t < sel[i].outPoint) sel[i].splitLayer(t);
    });
}

// 8 ── Freeze Frame at Playhead via Time Remap
function toolFreezeFrame() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp); if (!sel) return;
    undo("Freeze Frame", function () {
        var t = comp.time;
        for (var i = 0; i < sel.length; i++) {
            sel[i].timeRemapEnabled = true;
            var tr = sel[i].property("Time Remap");
            tr.setValueAtTime(sel[i].inPoint, t);
            tr.setValueAtTime(sel[i].outPoint, t);
        }
    });
}

// 9 ── Add loopOut("cycle") to all keyframed properties
function toolLoopExpression() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp); if (!sel) return;
    undo("Loop Expression", function () {
        for (var i = 0; i < sel.length; i++) {
            for (var g = 1; g <= sel[i].numProperties; g++) {
                var grp = sel[i].property(g);
                if (!grp || !grp.numProperties) continue;
                for (var p = 1; p <= grp.numProperties; p++) {
                    var prop = grp.property(p);
                    if (prop && prop.numKeys > 1 && prop.canSetExpression)
                        try { prop.expression = 'loopOut("cycle")'; } catch (e) {}
                }
            }
        }
    });
}

// 10 ── Easy Ease all keyframes
function toolEasyEase() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp); if (!sel) return;
    undo("Easy Ease", function () {
        for (var i = 0; i < sel.length; i++) {
            for (var g = 1; g <= sel[i].numProperties; g++) {
                var grp = sel[i].property(g);
                if (!grp || !grp.numProperties) continue;
                for (var p = 1; p <= grp.numProperties; p++) {
                    var prop = grp.property(p);
                    if (prop && prop.numKeys > 0) {
                        for (var k = 1; k <= prop.numKeys; k++) {
                            try {
                                prop.setTemporalEaseAtKey(k,
                                    [new KeyframeEase(0, 33)],
                                    [new KeyframeEase(0, 33)]);
                            } catch (e) {}
                        }
                    }
                }
            }
        }
    });
}

// 11 ── Toggle Motion Blur
function toolMotionBlur() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp); if (!sel) return;
    undo("Toggle Motion Blur", function () {
        var on = !sel[0].motionBlur;
        for (var i = 0; i < sel.length; i++) sel[i].motionBlur = on;
        comp.motionBlur = on;
    });
}

// 12 ── Add Guide Layer (red solid, set as guide)
function toolGuideLayer() {
    var comp = getComp(); if (!comp) return;
    undo("Guide Layer", function () {
        var g = comp.layers.addSolid([1, 0, 0], "Guide", comp.width, comp.height, 1);
        g.guideLayer = true; g.label = 2; g.name = "Guide";
    });
}

// 13 ── Trim selected layers to Work Area
function toolTrimWorkArea() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp); if (!sel) return;
    undo("Trim to Work Area", function () {
        var i = comp.workAreaStart, o = i + comp.workAreaDuration;
        for (var j = 0; j < sel.length; j++) { sel[j].inPoint = i; sel[j].outPoint = o; }
    });
}

// 14 ── Batch Rename (find & replace)
function toolBatchRename() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp); if (!sel) return;
    var find = prompt("Find:", "");       if (find === null) return;
    var rep  = prompt("Replace:", "");   if (rep  === null) return;
    undo("Batch Rename", function () {
        for (var i = 0; i < sel.length; i++)
            sel[i].name = sel[i].name.split(find).join(rep);
    });
}

// 15 ── Duplicate + Offset by 20 px
function toolDuplicateOffset() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp); if (!sel) return;
    undo("Duplicate Offset", function () {
        for (var i = 0; i < sel.length; i++) {
            var d = sel[i].duplicate();
            var p = d.property("Position").value;
            d.property("Position").setValue([p[0] + 20, p[1] + 20, p[2] || 0]);
        }
    });
}

// 16 ── Randomize layer Z-order (shuffle selected)
function toolRandomizeOrder() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp, 2); if (!sel) return;
    undo("Randomize Order", function () {
        var idx = [];
        for (var i = 0; i < sel.length; i++) idx.push(sel[i].index);
        for (var j = idx.length - 1; j > 0; j--) {
            var r = Math.floor(Math.random() * (j + 1));
            var tmp = idx[j]; idx[j] = idx[r]; idx[r] = tmp;
        }
        for (var k = 0; k < sel.length; k++) sel[k].moveToIndex(idx[k]);
    });
}

// 17 ── Color-code layers by type
function toolColorCode() {
    var comp = getComp(); if (!comp) return;
    undo("Color Code", function () {
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if      (l instanceof CameraLayer) l.label = 8;
            else if (l instanceof LightLayer)  l.label = 6;
            else if (l instanceof ShapeLayer)  l.label = 2;
            else if (l instanceof TextLayer)   l.label = 12;
            else if (l.nullLayer)              l.label = 11;
            else                               l.label = 3;
        }
    });
}

// 18 ── Toggle Solo
function toolToggleSolo() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp); if (!sel) return;
    undo("Toggle Solo", function () {
        var on = !sel[0].solo;
        for (var i = 0; i < sel.length; i++) sel[i].solo = on;
    });
}

// 19 ── Toggle Lock
function toolToggleLock() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp); if (!sel) return;
    undo("Toggle Lock", function () {
        var on = !sel[0].locked;
        for (var i = 0; i < sel.length; i++) sel[i].locked = on;
    });
}

// 20 ── Shy-toggle all layers + hide shys
function toolToggleShy() {
    var comp = getComp(); if (!comp) return;
    undo("Toggle Shy All", function () {
        var on = !comp.hideShyLayers;
        for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).shy = on;
        comp.hideShyLayers = on;
    });
}

// 21 ── Add Adjustment Layer
function toolAdjLayer() {
    var comp = getComp(); if (!comp) return;
    undo("Adjustment Layer", function () {
        var a = comp.layers.addSolid([1,1,1],"Adjustment Layer",
                    comp.width, comp.height, comp.pixelAspect, comp.duration);
        a.adjustmentLayer = true; a.label = 14;
    });
}

// 22 ── Add markers at regular time intervals
function toolMarkersAtInterval() {
    var comp = getComp(); if (!comp) return;
    var s = prompt("Interval (seconds):", "1"); if (s === null) return;
    var iv = parseFloat(s); if (isNaN(iv) || iv <= 0) { alert("Invalid interval."); return; }
    undo("Markers", function () {
        var t = 0, n = 1, m = comp.markerProperty;
        while (t <= comp.duration) { m.setValueAtTime(t, new MarkerValue("" + n)); t += iv; n++; }
    });
}

// 23 ── Flip Horizontal (negate X scale)
function toolFlipH() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp); if (!sel) return;
    undo("Flip H", function () {
        for (var i = 0; i < sel.length; i++) {
            var s = sel[i].property("Scale").value;
            sel[i].property("Scale").setValue([-s[0], s[1], s[2] || 100]);
        }
    });
}

// 24 ── Flip Vertical (negate Y scale)
function toolFlipV() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp); if (!sel) return;
    undo("Flip V", function () {
        for (var i = 0; i < sel.length; i++) {
            var s = sel[i].property("Scale").value;
            sel[i].property("Scale").setValue([s[0], -s[1], s[2] || 100]);
        }
    });
}

// 25 ── Reset Transform to defaults
function toolResetTransform() {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp); if (!sel) return;
    undo("Reset Transform", function () {
        for (var i = 0; i < sel.length; i++) {
            var l = sel[i];
            try { l.property("Position").setValue([comp.width/2, comp.height/2, 0]); } catch(e){}
            try { l.property("Scale").setValue([100, 100, 100]); } catch(e){}
            try { l.property("Rotation").setValue(0); } catch(e){}
            try { l.property("Opacity").setValue(100); } catch(e){}
        }
    });
}

// ════════════════════════════════════════════════════════════════
//  ANIMATION PRESETS  (25)  — applied to selected layers
// ════════════════════════════════════════════════════════════════
function applyPreset(name, fn) {
    var comp = getComp(); if (!comp) return;
    var sel = getSel(comp); if (!sel) return;
    app.beginUndoGroup(name);
    for (var i = 0; i < sel.length; i++) {
        try { fn(sel[i], comp); } catch (e) { alert("Error on " + sel[i].name + ": " + e); }
    }
    app.endUndoGroup();
}

// 1  Fade In
function presetFadeIn() {
    applyPreset("Fade In", function (l) {
        var op = l.property("Opacity");
        op.setValueAtTime(l.inPoint, 0);
        op.setValueAtTime(l.inPoint + 0.5, 100);
    });
}
// 2  Fade Out
function presetFadeOut() {
    applyPreset("Fade Out", function (l) {
        var op = l.property("Opacity");
        op.setValueAtTime(l.outPoint - 0.5, 100);
        op.setValueAtTime(l.outPoint, 0);
    });
}
// 3  Fade In/Out
function presetFadeInOut() {
    applyPreset("Fade In/Out", function (l) {
        var op = l.property("Opacity");
        op.setValueAtTime(l.inPoint, 0);
        op.setValueAtTime(l.inPoint + 0.5, 100);
        op.setValueAtTime(l.outPoint - 0.5, 100);
        op.setValueAtTime(l.outPoint, 0);
    });
}
// 4  Pop Scale In
function presetPopIn() {
    applyPreset("Pop In", function (l) {
        var sc = l.property("Scale"), op = l.property("Opacity"), t = l.inPoint;
        sc.setValueAtTime(t,        [0,   0,   100]);
        sc.setValueAtTime(t + 0.1,  [115, 115, 100]);
        sc.setValueAtTime(t + 0.2,  [100, 100, 100]);
        op.setValueAtTime(t,        0);
        op.setValueAtTime(t + 0.05, 100);
    });
}
// 5  Slide In Left
function presetSlideLeft() {
    applyPreset("Slide Left", function (l, comp) {
        var pos = l.property("Position"), c = pos.value, t = l.inPoint;
        pos.setValueAtTime(t,       [c[0] - comp.width, c[1], c[2]||0]);
        pos.setValueAtTime(t + 0.4, [c[0],              c[1], c[2]||0]);
    });
}
// 6  Slide In Right
function presetSlideRight() {
    applyPreset("Slide Right", function (l, comp) {
        var pos = l.property("Position"), c = pos.value, t = l.inPoint;
        pos.setValueAtTime(t,       [c[0] + comp.width, c[1], c[2]||0]);
        pos.setValueAtTime(t + 0.4, [c[0],              c[1], c[2]||0]);
    });
}
// 7  Slide In Top
function presetSlideTop() {
    applyPreset("Slide Top", function (l, comp) {
        var pos = l.property("Position"), c = pos.value, t = l.inPoint;
        pos.setValueAtTime(t,       [c[0], c[1] - comp.height, c[2]||0]);
        pos.setValueAtTime(t + 0.4, [c[0], c[1],              c[2]||0]);
    });
}
// 8  Slide In Bottom
function presetSlideBottom() {
    applyPreset("Slide Bottom", function (l, comp) {
        var pos = l.property("Position"), c = pos.value, t = l.inPoint;
        pos.setValueAtTime(t,       [c[0], c[1] + comp.height, c[2]||0]);
        pos.setValueAtTime(t + 0.4, [c[0], c[1],              c[2]||0]);
    });
}
// 9  Spin In
function presetSpinIn() {
    applyPreset("Spin In", function (l) {
        var rot = l.property("Rotation"), sc = l.property("Scale"), op = l.property("Opacity"), t = l.inPoint;
        rot.setValueAtTime(t,       -360); rot.setValueAtTime(t + 0.5, 0);
        sc.setValueAtTime(t,        [0,0,100]); sc.setValueAtTime(t + 0.5, [100,100,100]);
        op.setValueAtTime(t,        0); op.setValueAtTime(t + 0.2, 100);
    });
}
// 10  Typewriter (text layers only)
function presetTypewriter() {
    applyPreset("Typewriter", function (l) {
        if (!(l instanceof TextLayer)) { alert(l.name + " is not a text layer."); return; }
        var src = l.property("Source Text").value.toString();
        var dur = Math.min(src.length * 0.06, 4);
        var anims = l.property("ADBE Text Properties").property("ADBE Text Animators");
        var anim  = anims.addProperty("ADBE Text Animator");
        anim.name = "Typewriter";
        anim.property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity").setValue(0);
        var endProp = anim.property("ADBE Text Selectors")
                         .addProperty("ADBE Text Range Selector")
                         .property("ADBE Text Range End");
        endProp.setValueAtTime(l.inPoint,       0);
        endProp.setValueAtTime(l.inPoint + dur, 100);
    });
}
// 11  Bounce In (drop from above with settle)
function presetBounceIn() {
    applyPreset("Bounce In", function (l) {
        var pos = l.property("Position"), c = pos.value, t = l.inPoint;
        pos.setValueAtTime(t,        [c[0], c[1] - 200, c[2]||0]);
        pos.setValueAtTime(t + 0.30, [c[0], c[1] + 30,  c[2]||0]);
        pos.setValueAtTime(t + 0.45, [c[0], c[1] - 10,  c[2]||0]);
        pos.setValueAtTime(t + 0.55, [c[0], c[1],        c[2]||0]);
    });
}
// 12  Rubber Band (squash & stretch)
function presetRubberBand() {
    applyPreset("Rubber Band", function (l) {
        var sc = l.property("Scale"), t = l.inPoint;
        sc.setValueAtTime(t,        [100, 100, 100]);
        sc.setValueAtTime(t + 0.15, [120, 80,  100]);
        sc.setValueAtTime(t + 0.30, [85,  115, 100]);
        sc.setValueAtTime(t + 0.45, [108, 95,  100]);
        sc.setValueAtTime(t + 0.60, [100, 100, 100]);
    });
}
// 13  Shake (random position keys over 0.5 s)
function presetShake() {
    applyPreset("Shake", function (l, comp) {
        var pos = l.property("Position"), c = pos.value;
        var t = comp.time, step = 1 / comp.frameRate, dur = 0.5, amp = 15;
        for (var i = 0; i <= dur; i += step)
            pos.setValueAtTime(t + i, [c[0] + (Math.random() - 0.5) * amp * 2,
                                       c[1] + (Math.random() - 0.5) * amp * 2, c[2]||0]);
        pos.setValueAtTime(t + dur + step, [c[0], c[1], c[2]||0]);
    });
}
// 14  Glitch (rapid random opacity + slight scale jitter)
function presetGlitch() {
    applyPreset("Glitch", function (l, comp) {
        var op = l.property("Opacity"), sc = l.property("Scale"), cur = sc.value;
        var t = comp.time, step = 1 / comp.frameRate, dur = 0.5;
        for (var i = 0; i <= dur; i += step) {
            op.setValueAtTime(t + i, Math.random() > 0.25 ? 100 : Math.random() * 50 + 50);
            if (Math.random() > 0.65)
                sc.setValueAtTime(t + i, [cur[0] + (Math.random()-0.5)*10,
                                          cur[1] + (Math.random()-0.5)*10, cur[2]||100]);
        }
        op.setValueAtTime(t + dur + step, 100);
        sc.setValueAtTime(t + dur + step, cur);
    });
}
// 15  Float (looping vertical bob)
function presetFloat() {
    applyPreset("Float", function (l) {
        var pos = l.property("Position"), c = pos.value;
        pos.setValueAtTime(l.inPoint,     [c[0], c[1],      c[2]||0]);
        pos.setValueAtTime(l.inPoint + 1, [c[0], c[1] - 20, c[2]||0]);
        pos.setValueAtTime(l.inPoint + 2, [c[0], c[1],      c[2]||0]);
        pos.expression = 'loopOut("cycle")';
    });
}
// 16  Pulse Scale (looping scale beat)
function presetPulse() {
    applyPreset("Pulse", function (l) {
        var sc = l.property("Scale"), c = sc.value;
        sc.setValueAtTime(l.inPoint,     c);
        sc.setValueAtTime(l.inPoint + 0.5, [c[0]*1.1, c[1]*1.1, c[2]||100]);
        sc.setValueAtTime(l.inPoint + 1,   c);
        sc.expression = 'loopOut("cycle")';
    });
}
// 17  Blur In
function presetBlurIn() {
    applyPreset("Blur In", function (l) {
        var fx = l.property("ADBE Effect Parade");
        var bl = fx.addProperty("ADBE Fast Blur");
        bl.property("ADBE Fast Blur-0001").setValueAtTime(l.inPoint,       80);
        bl.property("ADBE Fast Blur-0001").setValueAtTime(l.inPoint + 0.5, 0);
        var op = l.property("Opacity");
        op.setValueAtTime(l.inPoint,       0);
        op.setValueAtTime(l.inPoint + 0.3, 100);
    });
}
// 18  Blur Out
function presetBlurOut() {
    applyPreset("Blur Out", function (l) {
        var fx = l.property("ADBE Effect Parade");
        var bl = fx.addProperty("ADBE Fast Blur");
        bl.property("ADBE Fast Blur-0001").setValueAtTime(l.outPoint - 0.5, 0);
        bl.property("ADBE Fast Blur-0001").setValueAtTime(l.outPoint,       80);
        var op = l.property("Opacity");
        op.setValueAtTime(l.outPoint - 0.3, 100);
        op.setValueAtTime(l.outPoint,        0);
    });
}
// 19  Flicker (random opacity expression)
function presetFlicker() {
    applyPreset("Flicker", function (l) {
        l.property("Opacity").expression = 'Math.random() > 0.1 ? 100 : Math.floor(Math.random()*60+20)';
    });
}
// 20  TV Static (rapid on/off expression)
function presetTVStatic() {
    applyPreset("TV Static", function (l) {
        l.property("Opacity").expression = 'Math.random() > 0.07 ? 100 : 0';
    });
}
// 21  Scale Bounce Out (pop then collapse to nothing)
function presetScaleBounce() {
    applyPreset("Scale Bounce", function (l) {
        var sc = l.property("Scale"), c = sc.value, op = l.property("Opacity"), t = l.outPoint;
        sc.setValueAtTime(t - 0.4, c);
        sc.setValueAtTime(t - 0.2, [c[0]*1.2, c[1]*1.2, c[2]||100]);
        sc.setValueAtTime(t,       [0, 0, c[2]||100]);
        op.setValueAtTime(t - 0.1, 100);
        op.setValueAtTime(t,       0);
    });
}
// 22  Rotate Loop (continuous 360°)
function presetRotateLoop() {
    applyPreset("Rotate Loop", function (l) {
        var rot = l.property("Rotation");
        rot.setValueAtTime(l.inPoint,     0);
        rot.setValueAtTime(l.inPoint + 2, 360);
        rot.expression = 'loopOut("cycle")';
    });
}
// 23  Color Cycle (hue rotation expression)
function presetColorCycle() {
    applyPreset("Color Cycle", function (l) {
        var hue = l.property("ADBE Effect Parade").addProperty("ADBE Hue Saturation");
        hue.name = "Color Cycle";
        hue.property("ADBE HueSaturation-0001").expression = 'time * 180';
    });
}
// 24  Position Wiggle (expression)
function presetPosWiggle() {
    applyPreset("Pos Wiggle", function (l) {
        l.property("Position").expression = 'wiggle(3, 20)';
    });
}
// 25  Drop Shadow Pulse (oscillating distance + softness)
function presetShadowPulse() {
    applyPreset("Shadow Pulse", function (l) {
        var shadow = l.property("ADBE Effect Parade").addProperty("ADBE Drop Shadow");
        shadow.property("ADBE Drop Shadow-0003").expression = 'Math.abs(Math.sin(time*2))*30'; // distance
        shadow.property("ADBE Drop Shadow-0005").expression = 'Math.abs(Math.sin(time*2))*20'; // softness
    });
}

// ════════════════════════════════════════════════════════════════
//  DATA TABLES
// ════════════════════════════════════════════════════════════════
var TOOLS = [
    { label:"Camera Rig",      fn:toolCameraRig,      tip:"Create null-first camera rig with all options as sliders" },
    { label:"Null Parent",     fn:toolNullParent,      tip:"Parent selected layers to a new null" },
    { label:"Wiggle Rig",      fn:toolWiggleRig,       tip:"Add wiggle controller with freq/amp sliders" },
    { label:"Sequence",        fn:toolSequenceLayers,  tip:"Arrange selected layers end-to-end in time" },
    { label:"Distribute",      fn:toolDistributeLayers,tip:"Evenly distribute selected layers vertically" },
    { label:"Auto Null All",   fn:toolAutoNullAll,     tip:"Parent every layer to its own null" },
    { label:"Split Layer",     fn:toolSplitAtPlayhead, tip:"Split selected layers at current time" },
    { label:"Freeze Frame",    fn:toolFreezeFrame,     tip:"Freeze selected layers at playhead via Time Remap" },
    { label:"Loop Expr",       fn:toolLoopExpression,  tip:"Add loopOut(cycle) to all keyframed properties" },
    { label:"Easy Ease",       fn:toolEasyEase,        tip:"Easy ease all keyframes on selected layers" },
    { label:"Motion Blur",     fn:toolMotionBlur,      tip:"Toggle motion blur on selected layers" },
    { label:"Guide Layer",     fn:toolGuideLayer,      tip:"Add a red guide layer" },
    { label:"Trim Work Area",  fn:toolTrimWorkArea,    tip:"Trim selected layers to composition work area" },
    { label:"Batch Rename",    fn:toolBatchRename,     tip:"Find & replace in layer names" },
    { label:"Dup + Offset",    fn:toolDuplicateOffset, tip:"Duplicate selected and offset by 20 px" },
    { label:"Randomize Z",     fn:toolRandomizeOrder,  tip:"Randomly shuffle Z-order of selected layers" },
    { label:"Color Code",      fn:toolColorCode,       tip:"Color-code all layers by type" },
    { label:"Solo Toggle",     fn:toolToggleSolo,      tip:"Toggle solo on selected layers" },
    { label:"Lock Toggle",     fn:toolToggleLock,      tip:"Toggle lock on selected layers" },
    { label:"Shy Toggle",      fn:toolToggleShy,       tip:"Shy all layers and toggle shy visibility" },
    { label:"Adj Layer",       fn:toolAdjLayer,        tip:"Add an adjustment layer at top of stack" },
    { label:"Add Markers",     fn:toolMarkersAtInterval,tip:"Add composition markers at a set interval" },
    { label:"Flip H",          fn:toolFlipH,           tip:"Flip selected layers horizontally (negate X scale)" },
    { label:"Flip V",          fn:toolFlipV,           tip:"Flip selected layers vertically (negate Y scale)" },
    { label:"Reset Transform", fn:toolResetTransform,  tip:"Reset position / scale / rotation / opacity" }
];

var PRESETS = [
    { label:"Fade In",       fn:presetFadeIn,      tip:"Fade opacity 0→100 from layer in-point" },
    { label:"Fade Out",      fn:presetFadeOut,     tip:"Fade opacity 100→0 at layer out-point" },
    { label:"Fade In/Out",   fn:presetFadeInOut,   tip:"Fade in at start, fade out at end" },
    { label:"Pop In",        fn:presetPopIn,       tip:"Scale pop-in from zero with overshoot" },
    { label:"Slide Left",    fn:presetSlideLeft,   tip:"Slide in from left edge" },
    { label:"Slide Right",   fn:presetSlideRight,  tip:"Slide in from right edge" },
    { label:"Slide Top",     fn:presetSlideTop,    tip:"Slide in from top edge" },
    { label:"Slide Bottom",  fn:presetSlideBottom, tip:"Slide in from bottom edge" },
    { label:"Spin In",       fn:presetSpinIn,      tip:"Spin + scale in from nothing" },
    { label:"Typewriter",    fn:presetTypewriter,  tip:"Reveal text character by character (text layers)" },
    { label:"Bounce In",     fn:presetBounceIn,    tip:"Drop in from above with settle bounce" },
    { label:"Rubber Band",   fn:presetRubberBand,  tip:"Elastic squash-and-stretch animation" },
    { label:"Shake",         fn:presetShake,       tip:"Frame-by-frame position shake at playhead" },
    { label:"Glitch",        fn:presetGlitch,      tip:"Digital glitch: opacity + scale jitter" },
    { label:"Float",         fn:presetFloat,       tip:"Looping vertical bob (cycle expression)" },
    { label:"Pulse",         fn:presetPulse,       tip:"Looping scale pulse (cycle expression)" },
    { label:"Blur In",       fn:presetBlurIn,      tip:"Fast Blur + opacity fade in" },
    { label:"Blur Out",      fn:presetBlurOut,     tip:"Fast Blur + opacity fade out" },
    { label:"Flicker",       fn:presetFlicker,     tip:"Randomly flicker opacity (expression)" },
    { label:"TV Static",     fn:presetTVStatic,    tip:"Rapid on/off opacity flash (expression)" },
    { label:"Scale Bounce",  fn:presetScaleBounce, tip:"Pop up then collapse to nothing at out-point" },
    { label:"Rotate Loop",   fn:presetRotateLoop,  tip:"Looping 360-degree rotation" },
    { label:"Color Cycle",   fn:presetColorCycle,  tip:"Continuously cycle hue via expression" },
    { label:"Pos Wiggle",    fn:presetPosWiggle,   tip:"wiggle(3, 20) on position (expression)" },
    { label:"Shadow Pulse",  fn:presetShadowPulse, tip:"Drop shadow distance + softness oscillation" }
];

// ════════════════════════════════════════════════════════════════
//  UI BUILDER
// ════════════════════════════════════════════════════════════════
function buildUI(thisObj) {
    var win = (thisObj instanceof Panel)
        ? thisObj
        : new Window("palette", "AfterTools", undefined, { resizeable: true });

    win.orientation   = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 4;  win.margins = 8;

    // ── Header ──
    var hdr = win.add("statictext", undefined, "\u25A0  AFTER TOOLS  \u25A0");
    hdr.alignment = ["center","top"];
    hdr.justify   = "center";

    var sub = win.add("statictext", undefined, "25 Tools  |  25 Presets");
    sub.alignment = ["center","top"];
    sub.justify   = "center";

    win.add("panel", undefined, "");   // divider

    // ── Tabs ──
    var tabs = win.add("tabbedpanel");
    tabs.alignChildren = ["fill","fill"];
    tabs.preferredSize = [310, 440];

    // Tools tab
    var tTab = tabs.add("tab", undefined, "Tools (25)");
    tTab.orientation = "column"; tTab.alignChildren = ["fill","top"];
    tTab.spacing = 3; tTab.margins = 6;
    buildGrid(tTab, TOOLS, 2);

    // Presets tab
    var pTab = tabs.add("tab", undefined, "Presets (25)");
    pTab.orientation = "column"; pTab.alignChildren = ["fill","top"];
    pTab.spacing = 3; pTab.margins = 6;
    buildGrid(pTab, PRESETS, 2);

    tabs.selection = tTab;

    if (win instanceof Window) { win.center(); win.show(); }
    else { win.layout.layout(true); }
    return win;
}

function buildGrid(parent, items, cols) {
    var row;
    for (var i = 0; i < items.length; i++) {
        if (i % cols === 0) {
            row = parent.add("group");
            row.orientation   = "row";
            row.alignChildren = ["fill","center"];
            row.spacing = 3;
        }
        (function (item) {
            var btn = row.add("button", undefined, item.label);
            btn.helpTip = item.tip;
            btn.preferredSize = [140, 26];
            btn.onClick = function () { item.fn(); };
        })(items[i]);
    }
}

buildUI(thisObj);
})(this);
