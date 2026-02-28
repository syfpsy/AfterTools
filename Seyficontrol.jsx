/*
    Seyficontrol.jsx
    Automatically creates expression controls (Slider, Color, Point, Angle, etc.)
    for every selected property and links them via expressions on the same layer.

    How to use:
      1. Select one or more properties in the Timeline panel
         (e.g. Position, Opacity, Fill Color, Rotation …)
      2. Run  File > Scripts > Run Script File  and choose this file.
      3. Open the Effects panel – your new controls are ready to tweak.

    Author: Cem / nightowl
    Usage:  File > Scripts > Run Script File  (requires an active composition)
*/

(function () {
    app.beginUndoGroup("Seyficontrol \u2013 Create Controls");

    try {
        // ─── Validate composition ───
        var comp = app.project.activeItem;

        if (!(comp && comp instanceof CompItem)) {
            alert("Seyficontrol\nPlease open a composition first.");
            return;
        }

        // ─── Gather selected properties ───
        var sel = comp.selectedProperties;

        if (!sel || sel.length === 0) {
            alert("Seyficontrol\nSelect one or more properties in the Timeline first.\n\n" +
                  "Examples: Position, Opacity, Scale, Fill Color, Rotation \u2026");
            return;
        }

        // Keep only animatable leaf properties, grouped by their parent layer
        var layerMap = {};   // layerIndex  →  { layer, props[] }

        for (var i = 0; i < sel.length; i++) {
            var prop = sel[i];

            // Must be an actual property (not a group) and expression-capable
            if (prop.propertyType !== PropertyType.PROPERTY) continue;
            if (!prop.canSetExpression) continue;

            // Walk up to the layer root
            var layer = prop.propertyGroup(prop.propertyDepth);
            var idx   = layer.index;

            if (!layerMap[idx]) {
                layerMap[idx] = { layer: layer, props: [] };
            }
            layerMap[idx].props.push(prop);
        }

        // Anything usable?
        var hasWork = false;
        for (var k in layerMap) { if (layerMap.hasOwnProperty(k)) { hasWork = true; break; } }

        if (!hasWork) {
            alert("Seyficontrol\nNo animatable properties in your selection.\n" +
                  "Supported: numbers, colors, 2D / 3D points, angles, booleans.");
            return;
        }

        // ─── Process each layer ───
        var created = 0;
        var skipped = 0;

        for (var key in layerMap) {
            if (!layerMap.hasOwnProperty(key)) continue;

            var entry = layerMap[key];
            var layer = entry.layer;
            var props = entry.props;
            var fxStack = layer.property("ADBE Effect Parade");

            for (var p = 0; p < props.length; p++) {
                var result = createControlForProperty(fxStack, props[p]);
                if (result) created++; else skipped++;
            }
        }

        // ─── Report ───
        var msg = "Seyficontrol\n";
        if (created > 0) {
            msg += "Created " + created + " expression control" + (created > 1 ? "s" : "") + ".";
            if (skipped > 0) msg += "\nSkipped " + skipped + " unsupported propert" + (skipped > 1 ? "ies" : "y") + ".";
            msg += "\n\nOpen the Effects panel to adjust them.";
        } else {
            msg += "No supported properties found.\n" +
                   "Supported types: numbers, colors, 2D/3D points, angles, booleans.";
        }
        alert(msg);

    } catch (err) {
        alert("Seyficontrol  Error\n" + err.toString());
    }

    app.endUndoGroup();

    // ═══════════════════════════════════════════════════════════════
    //  CORE – create one control and link it
    // ═══════════════════════════════════════════════════════════════

    function createControlForProperty(fxStack, prop) {
        var valType = prop.propertyValueType;
        var currentVal;

        try { currentVal = prop.value; } catch (e) { return false; }

        var matchName;    // AE internal match name for the effect
        var subPropName;  // sub-property inside the effect
        var setVal = currentVal;

        switch (valType) {

            // ── Color ──
            case PropertyValueType.COLOR:
                matchName   = "ADBE Color Control";
                subPropName = "Color";
                break;

            // ── 3D (spatial or non-spatial) ──
            case PropertyValueType.ThreeD_SPATIAL:
            case PropertyValueType.ThreeD:
                matchName   = "ADBE Point3D Control";
                subPropName = "3D Point";
                break;

            // ── 2D (spatial or non-spatial) ──
            case PropertyValueType.TwoD_SPATIAL:
            case PropertyValueType.TwoD:
                matchName   = "ADBE Point Control";
                subPropName = "Point";
                break;

            // ── Scalar ──
            case PropertyValueType.OneD:
                if (isBooleanish(prop)) {
                    matchName   = "ADBE Checkbox Control";
                    subPropName = "Checkbox";
                } else if (isAngleish(prop)) {
                    matchName   = "ADBE Angle Control";
                    subPropName = "Angle";
                } else {
                    matchName   = "ADBE Slider Control";
                    subPropName = "Slider";
                }
                break;

            // ── Layer index ──
            case PropertyValueType.LAYER_INDEX:
                matchName   = "ADBE Layer Control";
                subPropName = "Layer";
                break;

            default:
                return false;   // unsupported (shape, text doc, marker …)
        }

        // ── Friendly name ──
        var controlName = buildControlName(prop);
        controlName     = ensureUnique(fxStack, controlName);

        // ── Add the control ──
        var ctrl = fxStack.addProperty(matchName);
        ctrl.name = controlName;

        // ── Set the current value as default ──
        try {
            ctrl.property(subPropName).setValue(setVal);
        } catch (e) { /* some values resist being set – carry on */ }

        // ── Wire expression ──
        var expr = 'thisLayer.effect("' + controlName + '")("' + subPropName + '")';

        // Color properties in AE are 0-1 but some effects work in 0-255.
        // The Color Control always stores 0-1, so a direct link is correct.

        try {
            prop.expression = expr;
        } catch (e) { /* expression may be disallowed on rare properties */ }

        return true;
    }

    // ═══════════════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Build a human-readable control name from the property path.
     *   "Transform : Position"
     *   "Fill : Color"
     *   "Masks : Mask 1 : Mask Opacity"
     * Keeps at most the two deepest groups + the property name.
     */
    function buildControlName(prop) {
        var parts = [];
        var depth = prop.propertyDepth;

        // Walk from immediate parent (depth-1) up, skip the layer itself (depth)
        for (var d = 1; d < depth; d++) {
            var grp = prop.propertyGroup(d);
            if (!grp || !grp.name) continue;

            var n = grp.name;
            // Skip generic root containers that add no meaning
            if (n === "Effects" || n === "ADBE Effect Parade" ||
                n === "Content" || n === "ADBE Root Vectors Group") continue;

            parts.unshift(n);
        }

        parts.push(prop.name);

        // Keep last 3 segments max → "Group : SubGroup : Property"
        if (parts.length > 3) {
            parts = parts.slice(parts.length - 3);
        }

        return parts.join(" : ");
    }

    /**
     * Append a counter if a control with the same name already exists.
     */
    function ensureUnique(fxStack, baseName) {
        var name = baseName;
        var n = 2;
        while (nameExists(fxStack, name)) {
            name = baseName + " " + n;
            n++;
        }
        return name;
    }

    function nameExists(fxStack, name) {
        for (var i = 1; i <= fxStack.numProperties; i++) {
            if (fxStack.property(i).name === name) return true;
        }
        return false;
    }

    /**
     * Heuristic: detect boolean/toggle properties (OneD with 0-or-1 semantics).
     */
    function isBooleanish(prop) {
        var v = prop.value;
        if (v !== 0 && v !== 1) return false;

        var n  = prop.name.toLowerCase();
        var mn = prop.matchName.toLowerCase();

        var hints = [
            "on", "off", "enable", "disable", "visible", "mute",
            "solo", "shy", "collapse", "hide", "lock", "guide",
            "depth of field", "motion blur", "reverse", "mirror",
            "invert", "clockwise", "3d layer", "preserve",
            "continuously rasterize", "audio"
        ];
        for (var i = 0; i < hints.length; i++) {
            if (n.indexOf(hints[i]) !== -1) return true;
        }

        if (mn.indexOf("bool") !== -1 || mn.indexOf("onoff") !== -1) return true;

        return false;
    }

    /**
     * Heuristic: detect angle / rotation properties.
     */
    function isAngleish(prop) {
        var n  = prop.name.toLowerCase();
        var mn = prop.matchName.toLowerCase();

        var hints = [
            "rotation", "rotate", "angle", "orient", "direction",
            "shutter angle", "skew axis"
        ];
        for (var i = 0; i < hints.length; i++) {
            if (n.indexOf(hints[i]) !== -1 || mn.indexOf(hints[i]) !== -1) return true;
        }

        // AE internal match names for rotation properties
        if (mn.indexOf("rot") !== -1) return true;

        return false;
    }

})();
