/*
    Easing.jsx — Dockable ScriptUI Panel
    Applies Apple / Google / Microsoft easing curves to selected keyframes.

    Author: Cem / nightowl
    Install: Copy to After Effects > Scripts > ScriptUI Panels, restart AE.
             Find it under Window > Easing.jsx — dock anywhere you like.
*/

(function (thisObj) {

    // ═══════════════════════════════════════
    //  EASING LIBRARY  [x1, y1, x2, y2]
    // ═══════════════════════════════════════

    var LIB = {
        "Apple": [
            ["Default",     [0.25, 0.10, 0.25, 1.00]],
            ["Ease In",     [0.42, 0.00, 1.00, 1.00]],
            ["Ease Out",    [0.00, 0.00, 0.58, 1.00]],
            ["Ease In Out", [0.42, 0.00, 0.58, 1.00]],
            ["Spring",      [0.28, 0.84, 0.42, 1.00]],
            ["Keyboard",    [0.10, 0.76, 0.55, 0.90]]
        ],
        "Google": [
            ["Standard",              [0.20, 0.00, 0.00, 1.00]],
            ["Standard Decel",        [0.00, 0.00, 0.00, 1.00]],
            ["Standard Accel",        [0.30, 0.00, 1.00, 1.00]],
            ["Emphasized Decel",      [0.05, 0.70, 0.10, 1.00]],
            ["Emphasized Accel",      [0.30, 0.00, 0.80, 0.15]],
            ["Legacy Standard",       [0.40, 0.00, 0.20, 1.00]]
        ],
        "Microsoft": [
            ["Decelerate",     [0.00, 0.00, 0.00, 1.00]],
            ["Accelerate",     [1.00, 0.00, 1.00, 1.00]],
            ["Point to Point", [0.80, 0.00, 0.20, 1.00]],
            ["Fade In",        [0.10, 0.90, 0.20, 1.00]],
            ["Fade Out",       [0.20, 0.00, 0.00, 1.00]]
        ]
    };

    var BRANDS = ["Apple", "Google", "Microsoft"];
    var ACCENT = {
        "Apple":     [1.00, 1.00, 1.00],
        "Google":    [0.35, 0.76, 0.40],
        "Microsoft": [0.40, 0.56, 1.00]
    };

    // ═══════════════════════════════════════
    //  FONTS
    // ═══════════════════════════════════════

    var F_TITLE = ScriptUI.newFont("Helvetica", "BOLD", 14);
    var F_NAME  = ScriptUI.newFont("Helvetica", "BOLD", 11);
    var F_VAL   = ScriptUI.newFont("Helvetica", "REGULAR", 9);

    // ═══════════════════════════════════════
    //  FORMAT HELPERS
    // ═══════════════════════════════════════

    function fmt(v) {
        if (v === 0) return "0";
        if (v === 1) return "1";
        var s = v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
        if (s.length > 1 && s.charAt(0) === "0" && s.charAt(1) === ".") s = s.substring(1);
        return s;
    }

    function fmtC(c) {
        return fmt(c[0]) + ",  " + fmt(c[1]) + ",  " + fmt(c[2]) + ",  " + fmt(c[3]);
    }

    // ═══════════════════════════════════════
    //  DRAW CURVE PREVIEW
    // ═══════════════════════════════════════

    function drawCurvePreview(g, c, x, y, w, h, ac) {
        // Dark inset background
        g.rectPath(x, y, w, h);
        g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, [0.075, 0.075, 0.075, 1]));

        // Grid — center cross
        var gridPen = g.newPen(g.PenType.SOLID_COLOR, [0.14, 0.14, 0.14, 1], 1);
        g.newPath(); g.moveTo(x, y + h * 0.5); g.lineTo(x + w, y + h * 0.5); g.strokePath(gridPen);
        g.newPath(); g.moveTo(x + w * 0.5, y); g.lineTo(x + w * 0.5, y + h); g.strokePath(gridPen);

        // Diagonal — linear reference
        var diagPen = g.newPen(g.PenType.SOLID_COLOR, [0.18, 0.18, 0.18, 1], 1);
        g.newPath(); g.moveTo(x, y + h); g.lineTo(x + w, y); g.strokePath(diagPen);

        // Control-point handles
        var hPen = g.newPen(g.PenType.SOLID_COLOR, [ac[0], ac[1], ac[2], 0.22], 1);
        var p1x = x + c[0] * w, p1y = y + h - c[1] * h;
        var p2x = x + c[2] * w, p2y = y + h - c[3] * h;
        g.newPath(); g.moveTo(x, y + h);  g.lineTo(p1x, p1y); g.strokePath(hPen);
        g.newPath(); g.moveTo(x + w, y);  g.lineTo(p2x, p2y); g.strokePath(hPen);

        // Handle dots
        var hBr = g.newBrush(g.BrushType.SOLID_COLOR, [ac[0], ac[1], ac[2], 0.4]);
        g.ellipsePath(p1x - 2.5, p1y - 2.5, 5, 5); g.fillPath(hBr);
        g.ellipsePath(p2x - 2.5, p2y - 2.5, 5, 5); g.fillPath(hBr);

        // Bezier curve (48 segments)
        var cPen = g.newPen(g.PenType.SOLID_COLOR, [ac[0], ac[1], ac[2], 1.0], 2);
        g.newPath();
        for (var i = 0; i <= 48; i++) {
            var t = i / 48, u = 1 - t;
            var bx = 3 * u * u * t * c[0] + 3 * u * t * t * c[2] + t * t * t;
            var by = 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t;
            var px = x + bx * w, py = y + h - by * h;
            if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.strokePath(cPen);

        // Endpoint dots
        var eBr = g.newBrush(g.BrushType.SOLID_COLOR, [ac[0], ac[1], ac[2], 1]);
        g.ellipsePath(x - 3, y + h - 3, 6, 6);   g.fillPath(eBr);
        g.ellipsePath(x + w - 3, y - 3, 6, 6);    g.fillPath(eBr);

        // Border
        var bPen = g.newPen(g.PenType.SOLID_COLOR, [0.22, 0.22, 0.22, 1], 1);
        g.newPath();
        g.rectPath(x, y, w, h);
        g.strokePath(bPen);
    }

    // ═══════════════════════════════════════
    //  BEZIER → AE KEYFRAME EASE
    // ═══════════════════════════════════════

    function clampInf(v) { return Math.max(0.1, Math.min(100, v)); }

    function applyEase(prop, keyIdx, curve) {
        var x1 = curve[0], y1 = curve[1], x2 = curve[2], y2 = curve[3];
        var numKeys = prop.numKeys;
        if (numKeys < 2 || keyIdx < 1 || keyIdx > numKeys) return;

        var dims = prop.value instanceof Array ? prop.value.length : 1;

        // Outgoing ease (this key → next key)
        if (keyIdx < numKeys) {
            var dt = prop.keyTime(keyIdx + 1) - prop.keyTime(keyIdx);
            var v0 = prop.keyValue(keyIdx);
            var v1 = prop.keyValue(keyIdx + 1);
            var outInf = clampInf(x1 * 100);
            var outEases = [];
            for (var d = 0; d < dims; d++) {
                var dv = dims > 1 ? (v1[d] - v0[d]) : (v1 - v0);
                var lin = dt > 0 ? Math.abs(dv) / dt : 0;
                var mul = (x1 > 0.001) ? (y1 / x1) : 1;
                outEases.push(new KeyframeEase(lin * mul, outInf));
            }
            prop.setTemporalEaseAtKey(keyIdx, prop.keyInTemporalEase(keyIdx), outEases);
        }

        // Incoming ease (this key's next keyframe)
        if (keyIdx < numKeys) {
            var nk = keyIdx + 1;
            var dt2 = prop.keyTime(nk) - prop.keyTime(keyIdx);
            var va = prop.keyValue(keyIdx);
            var vb = prop.keyValue(nk);
            var inInf = clampInf((1 - x2) * 100);
            var inEases = [];
            for (var d2 = 0; d2 < dims; d2++) {
                var dv2 = dims > 1 ? (vb[d2] - va[d2]) : (vb - va);
                var lin2 = dt2 > 0 ? Math.abs(dv2) / dt2 : 0;
                var tail = 1 - x2;
                var mul2 = (tail > 0.001) ? ((1 - y2) / tail) : 1;
                inEases.push(new KeyframeEase(lin2 * mul2, inInf));
            }
            prop.setTemporalEaseAtKey(nk, inEases, prop.keyOutTemporalEase(nk));
        }
    }

    // ═══════════════════════════════════════
    //  APPLY TO SELECTION
    // ═══════════════════════════════════════

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
        var n = 0;
        for (var p = 0; p < props.length; p++) {
            var pr = props[p];
            if (pr.numKeys < 2) continue;
            var sk = pr.selectedKeys;
            if (!sk || sk.length === 0) continue;
            for (var k = 0; k < sk.length; k++) {
                try {
                    pr.setInterpolationTypeAtKey(sk[k],
                        KeyframeInterpolationType.BEZIER,
                        KeyframeInterpolationType.BEZIER);
                } catch (e) {}
                applyEase(pr, sk[k], curve);
                n++;
            }
        }
        app.endUndoGroup();
        if (n === 0) alert("No keyframes selected.\nSelect keyframes in the timeline first.");
    }

    // ═══════════════════════════════════════
    //  BUILD UI
    // ═══════════════════════════════════════

    function buildUI(container) {
        var win = (container instanceof Panel)
            ? container
            : new Window("palette", "Easing", undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = [10, 12, 10, 10];

        // ── Title ──
        var hdr = win.add("group");
        hdr.alignment = ["center", "top"];
        hdr.margins = [0, 0, 0, 2];
        var ttl = hdr.add("statictext", undefined, "E A S I N G");
        ttl.graphics.font = F_TITLE;

        // ── Tab bar ──
        var tabGrp = win.add("group");
        tabGrp.alignment = ["fill", "top"];
        tabGrp.alignChildren = ["fill", "center"];
        tabGrp.spacing = 4;

        var activeBrand = BRANDS[0];
        var panels = {};

        for (var b = 0; b < BRANDS.length; b++) {
            (function (brand) {
                var tb = tabGrp.add("button", undefined, brand);
                tb.preferredSize = [0, 26];
                tb.onClick = function () {
                    activeBrand = brand;
                    for (var i = 0; i < BRANDS.length; i++)
                        panels[BRANDS[i]].visible = (BRANDS[i] === brand);
                    win.layout.layout(true);
                };
            })(BRANDS[b]);
        }

        // ── Card container (stacked per brand) ──
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
                pnl.spacing = 3;
                pnl.visible = (brand === activeBrand);

                var curves = LIB[brand];
                var accent = ACCENT[brand];

                for (var i = 0; i < curves.length; i++) {
                    (function (cName, cVal) {
                        var card = pnl.add("button", undefined, "");
                        card.preferredSize = [0, 58];
                        card.alignment = ["fill", "top"];
                        card.helpTip = cName + "\ncubic-bezier(" + cVal.join(", ") + ")";

                        card.onClick = function () { applyToSelected(cVal); };

                        card.onDraw = function () {
                            var g = this.graphics;
                            var W = this.size[0], H = this.size[1];

                            // Card background
                            g.rectPath(0, 0, W, H);
                            g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, [0.16, 0.16, 0.16, 1]));

                            // Curve preview area
                            var pad = 7;
                            var cs = H - pad * 2;
                            drawCurvePreview(g, cVal, pad, pad, cs, cs, accent);

                            // Name
                            var tx = pad + cs + 14;
                            g.drawString(cName,
                                g.newPen(g.PenType.SOLID_COLOR, [0.88, 0.88, 0.88, 1], 1),
                                tx, pad + 2, F_NAME);

                            // Values
                            g.drawString(fmtC(cVal),
                                g.newPen(g.PenType.SOLID_COLOR, [0.40, 0.40, 0.40, 1], 1),
                                tx, pad + 22, F_VAL);
                        };
                    })(curves[i][0], curves[i][1]);
                }

                panels[brand] = pnl;
            })(BRANDS[b2]);
        }

        // ── Footer ──
        win.add("panel", undefined, "");
        var foot = win.add("statictext", undefined, "Select keyframes \u2219 Click a curve");
        foot.alignment = ["center", "bottom"];
        foot.graphics.font = F_VAL;

        // ── Resize handler for docking ──
        win.onResizing = win.onResize = function () { this.layout.layout(true); };

        if (win instanceof Window) {
            win.center();
            win.show();
        }

        win.layout.layout(true);
        return win;
    }

    buildUI(thisObj);

})(this);
