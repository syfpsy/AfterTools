/*
    Easing.jsx
    Applies Apple / Google / Microsoft easing curves to selected keyframes.

    Author: Cem / nightowl
    Usage:  File > Scripts > Run Script File  (or install as ScriptUI panel)

    Curves
    ──────
    Apple   – iOS CAMediaTimingFunction defaults
    Google  – Material Design 3 motion tokens
    Microsoft – Fluent Design motion system
*/

(function (thisObj) {

    // ═══════════════════════════════════════════════════
    //  EASING LIBRARY  [x1, y1, x2, y2]
    // ═══════════════════════════════════════════════════

    var LIB = {
        "Apple": {
            "Default":       [0.25, 0.10, 0.25, 1.00],
            "Ease In":       [0.42, 0.00, 1.00, 1.00],
            "Ease Out":      [0.00, 0.00, 0.58, 1.00],
            "Ease In Out":   [0.42, 0.00, 0.58, 1.00],
            "Spring":        [0.28, 0.84, 0.42, 1.00],
            "Keyboard":      [0.10, 0.76, 0.55, 0.90]
        },
        "Google": {
            "Standard":              [0.20, 0.00, 0.00, 1.00],
            "Standard Decelerate":   [0.00, 0.00, 0.00, 1.00],
            "Standard Accelerate":   [0.30, 0.00, 1.00, 1.00],
            "Emphasized Decelerate": [0.05, 0.70, 0.10, 1.00],
            "Emphasized Accelerate": [0.30, 0.00, 0.80, 0.15],
            "Legacy Standard":       [0.40, 0.00, 0.20, 1.00]
        },
        "Microsoft": {
            "Decelerate":    [0.00, 0.00, 0.00, 1.00],
            "Accelerate":    [1.00, 0.00, 1.00, 1.00],
            "Point to Point":[0.80, 0.00, 0.20, 1.00],
            "Fade In":       [0.10, 0.90, 0.20, 1.00],
            "Fade Out":      [0.20, 0.00, 0.00, 1.00]
        }
    };

    var BRANDS = ["Apple", "Google", "Microsoft"];

    // ═══════════════════════════════════════════════════
    //  BEZIER → AE KEYFRAME EASE  CONVERSION
    // ═══════════════════════════════════════════════════

    /*
        After Effects sets easing via KeyframeEase(speed, influence).
        - influence (0-100%) maps to the x-handle of the bezier.
        - speed is derived from value delta / time delta scaled by
          the y-handle ratio.

        For a cubic-bezier(x1,y1,x2,y2) between two keys:
          outgoing key 1  →  influence = x1 * 100,  speed factor = y1/x1
          incoming key 2  →  influence = (1-x2)*100, speed factor = (1-y2)/(1-x2)

        We compute absolute speed from the value & time span.
    */

    function applyEase(prop, keyIdx, curve) {
        var x1 = curve[0], y1 = curve[1], x2 = curve[2], y2 = curve[3];
        var numKeys = prop.numKeys;
        if (numKeys < 2 || keyIdx < 1 || keyIdx > numKeys) return;

        // Clamp influences to AE range 0.1 – 100
        function clampInf(v) { return Math.max(0.1, Math.min(100, v)); }

        var dims = prop.value instanceof Array ? prop.value.length : 1;

        // ── outgoing ease of this key (toward next key) ──
        if (keyIdx < numKeys) {
            var dt = prop.keyTime(keyIdx + 1) - prop.keyTime(keyIdx);
            var v0 = prop.keyValue(keyIdx);
            var v1 = prop.keyValue(keyIdx + 1);
            var outInf = clampInf(x1 * 100);
            var outEases = [];
            for (var d = 0; d < dims; d++) {
                var dv = dims > 1 ? (v1[d] - v0[d]) : (v1 - v0);
                var linearSpeed = dt > 0 ? Math.abs(dv) / dt : 0;
                var speedMul = (x1 > 0.001) ? (y1 / x1) : 1;
                var spd = linearSpeed * speedMul;
                outEases.push(new KeyframeEase(spd, outInf));
            }
            prop.setTemporalEaseAtKey(keyIdx, prop.keyInTemporalEase(keyIdx), outEases);
        }

        // ── incoming ease of next key ──
        if (keyIdx < numKeys) {
            var nextIdx = keyIdx + 1;
            var dt2 = prop.keyTime(nextIdx) - prop.keyTime(keyIdx);
            var va = prop.keyValue(keyIdx);
            var vb = prop.keyValue(nextIdx);
            var inInf = clampInf((1 - x2) * 100);
            var inEases = [];
            for (var d2 = 0; d2 < dims; d2++) {
                var dv2 = dims > 1 ? (vb[d2] - va[d2]) : (vb - va);
                var linearSpeed2 = dt2 > 0 ? Math.abs(dv2) / dt2 : 0;
                var x2tail = 1 - x2;
                var speedMul2 = (x2tail > 0.001) ? ((1 - y2) / x2tail) : 1;
                var spd2 = linearSpeed2 * speedMul2;
                inEases.push(new KeyframeEase(spd2, inInf));
            }
            prop.setTemporalEaseAtKey(nextIdx, inEases, prop.keyOutTemporalEase(nextIdx));
        }
    }

    // ═══════════════════════════════════════════════════
    //  APPLY TO SELECTION
    // ═══════════════════════════════════════════════════

    function applyToSelected(curve) {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            alert("Open a composition first.");
            return;
        }

        var props = comp.selectedProperties;
        if (!props || props.length === 0) {
            alert("Select at least one property with keyframes.");
            return;
        }

        app.beginUndoGroup("Apply Easing");

        var applied = 0;
        for (var p = 0; p < props.length; p++) {
            var prop = props[p];
            if (prop.numKeys < 2) continue;
            var selKeys = prop.selectedKeys;
            if (!selKeys || selKeys.length === 0) continue;

            for (var k = 0; k < selKeys.length; k++) {
                // Convert roving / hold to continuous first
                try {
                    prop.setInterpolationTypeAtKey(
                        selKeys[k],
                        KeyframeInterpolationType.BEZIER,
                        KeyframeInterpolationType.BEZIER
                    );
                } catch (e) {}
                applyEase(prop, selKeys[k], curve);
                applied++;
            }
        }

        app.endUndoGroup();

        if (applied === 0) {
            alert("No keyframes were selected.\nSelect keyframes in the timeline first.");
        }
    }

    // ═══════════════════════════════════════════════════
    //  UI  (ScriptUI Panel / Dialog)
    // ═══════════════════════════════════════════════════

    function buildUI(container) {
        var win = (container instanceof Panel)
            ? container
            : new Window("palette", "Easing", undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = [12, 12, 12, 12];

        // ── Title ──
        var hdr = win.add("group");
        hdr.alignment = ["center", "top"];
        var title = hdr.add("statictext", undefined, "EASING");
        title.graphics.font = ScriptUI.newFont("Helvetica", "BOLD", 14);

        // ── Brand tabs ──
        var tabGroup = win.add("group");
        tabGroup.alignment = ["center", "top"];
        tabGroup.spacing = 4;

        var panels = {};
        var tabBtns = {};
        var activeBrand = BRANDS[0];

        for (var b = 0; b < BRANDS.length; b++) {
            (function (brand) {
                var btn = tabGroup.add("button", undefined, brand);
                btn.preferredSize = [90, 26];
                tabBtns[brand] = btn;

                btn.onClick = function () {
                    activeBrand = brand;
                    showBrand(brand);
                };
            })(BRANDS[b]);
        }

        // ── Curve buttons container ──
        var stack = win.add("group");
        stack.orientation = "stack";
        stack.alignment = ["fill", "fill"];
        stack.alignChildren = ["fill", "top"];

        for (var b2 = 0; b2 < BRANDS.length; b2++) {
            (function (brand) {
                var pnl = stack.add("group");
                pnl.orientation = "column";
                pnl.alignment = ["fill", "top"];
                pnl.alignChildren = ["fill", "top"];
                pnl.spacing = 4;
                pnl.visible = false;

                var curves = LIB[brand];
                for (var name in curves) {
                    if (!curves.hasOwnProperty(name)) continue;
                    (function (cName, cVal) {
                        var row = pnl.add("group");
                        row.alignment = ["fill", "top"];

                        var btn = row.add("button", undefined, cName);
                        btn.alignment = ["fill", "center"];
                        btn.preferredSize = [0, 28];

                        btn.onClick = function () {
                            applyToSelected(cVal);
                        };

                        // Tooltip with bezier values
                        btn.helpTip = "cubic-bezier(" + cVal.join(", ") + ")";
                    })(name, curves[name]);
                }

                panels[brand] = pnl;
            })(BRANDS[b2]);
        }

        // ── Separator ──
        win.add("panel", undefined, "");

        // ── Info line ──
        var info = win.add("statictext", undefined, "Select keyframes, then click a curve.");
        info.alignment = ["center", "bottom"];

        // ── Show / hide logic ──
        function showBrand(brand) {
            for (var i = 0; i < BRANDS.length; i++) {
                panels[BRANDS[i]].visible = (BRANDS[i] === brand);
            }
            win.layout.layout(true);
        }

        showBrand(activeBrand);

        if (win instanceof Window) {
            win.center();
            win.show();
        }

        win.layout.layout(true);

        return win;
    }

    buildUI(thisObj);

})(this);
