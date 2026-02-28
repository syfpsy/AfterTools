/**
 * CemToolbox.jsx
 * =============================================================================
 * Production-ready, dockable ScriptUI Panel for Adobe After Effects.
 * A drop-in launcher for .jsx tool scripts and .ffx animation presets.
 *
 * Version      : 1.0.0
 * Compatibility: After Effects CC 2018+ (CC 2020+ recommended)
 * Install path : Scripts/ScriptUI Panels/CemToolbox.jsx
 * Open via     : Window > CemToolbox
 *
 * File structure (sibling folder, same directory as this file):
 *   CemToolbox/
 *     tools/     — .jsx tool scripts
 *     presets/   — .ffx preset files (subfolders supported)
 *     icons/     — optional .png icons for tools
 *     data/      — manifest.json, settings.json, log.txt  (auto-created)
 *     lib/       — shared libraries (optional)
 *     docs/      — documentation (optional)
 * =============================================================================
 */

#target aftereffects
#targetengine "CemToolbox"

/* ============================================================
 * ENTRY POINT — wraps everything in an IIFE so nothing leaks
 * into the global ExtendScript engine namespace.
 * `thisObj` is the Panel when docked, Window otherwise.
 * ============================================================ */
(function CemToolboxApp(thisObj) {

    // =========================================================================
    // SECTION 1 — CONSTANTS
    // Central config object. Tweak UI sizes and names here.
    // =========================================================================
    var CT = {
        NAME    : "CemToolbox",
        VERSION : "1.0.0",
        FOLDER  : "CemToolbox",      // Sibling folder name (next to this .jsx)

        // Subfolder keys — must match CT.DIRS values for Paths.dir()
        DIRS: {
            TOOLS   : "tools",
            PRESETS : "presets",
            ICONS   : "icons",
            DATA    : "data",
            LIB     : "lib",
            DOCS    : "docs"
        },

        FILES: {
            MANIFEST : "manifest.json",
            SETTINGS : "settings.json",
            LOG      : "log.txt"
        },

        // Numeric log levels (higher = more severe)
        LOG_LEVEL: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 },

        // Reserved category names used in sidebar
        CAT: {
            ALL       : "All Tools",
            FAVORITES : "\u2605 Favorites",   // ★ Favorites
            PRESETS   : "FFX Presets"
        },

        // UI geometry constants (pixels)
        UI: {
            MIN_W         : 560,
            MIN_H         : 430,
            SIDEBAR_W     : 148,
            LIST_ROW_H    : 22,
            STATUS_H      : 22,
            PAD           : 6,
            MAX_LOG_LINES : 200
        },

        // Log file rotation threshold (bytes)
        MAX_LOG_SIZE: 512 * 1024
    };

    // =========================================================================
    // SECTION 2 — JSON POLYFILL
    // AE 2018 ships ExtendScript 16.x which includes native JSON,
    // but we supply a fallback for edge cases / very old engines.
    // =========================================================================
    (function bootstrapJSON() {
        if (typeof JSON !== "undefined" &&
            typeof JSON.parse === "function" &&
            typeof JSON.stringify === "function") { return; }

        var J = {};

        J.stringify = function(val, replacer, space) {
            var ind = "";
            if (typeof space === "number") {
                for (var s = 0; s < space; s++) { ind += " "; }
            } else if (typeof space === "string") { ind = space; }

            function esc(str) {
                return str
                    .replace(/\\/g, "\\\\").replace(/"/g, '\\"')
                    .replace(/\n/g, "\\n").replace(/\r/g, "\\r")
                    .replace(/\t/g, "\\t")
                    .replace(/[\x00-\x1f]/g, function(c) {
                        return "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4);
                    });
            }

            function ser(v, depth) {
                if (v === null)      { return "null"; }
                if (v === undefined) { return undefined; }
                var t = typeof v;
                if (t === "boolean") { return v ? "true" : "false"; }
                if (t === "number")  { return isFinite(v) ? String(v) : "null"; }
                if (t === "string")  { return '"' + esc(v) + '"'; }
                if (t === "object") {
                    var pp = "";
                    if (ind) { for (var d = 0; d < depth; d++) { pp += ind; } }
                    var cp = "";
                    if (ind) { for (var cd = 0; cd < depth - 1; cd++) { cp += ind; } }

                    if (v instanceof Array) {
                        var ai = [];
                        for (var ii = 0; ii < v.length; ii++) {
                            var ae = ser(v[ii], depth + 1);
                            ai.push(ae !== undefined ? ae : "null");
                        }
                        if (!ind) { return "[" + ai.join(",") + "]"; }
                        return ai.length === 0 ? "[]" :
                            "[\n" + pp + ai.join(",\n" + pp) + "\n" + cp + "]";
                    }

                    var kv = [];
                    for (var k in v) {
                        if (v.hasOwnProperty(k)) {
                            var vv = ser(v[k], depth + 1);
                            if (vv !== undefined) {
                                kv.push('"' + esc(k) + '":' + (ind ? " " : "") + vv);
                            }
                        }
                    }
                    if (!ind) { return "{" + kv.join(",") + "}"; }
                    return kv.length === 0 ? "{}" :
                        "{\n" + pp + kv.join(",\n" + pp) + "\n" + cp + "}";
                }
                return undefined;
            }
            return ser(val, 1);
        };

        J.parse = function(str) {
            if (typeof str !== "string") { throw new TypeError("JSON.parse expects a string"); }
            // Basic safety gate: reject anything not plausibly JSON chars
            if (/[^,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]/.test(
                    str.replace(/"(\\.|[^"\\])*"/g, ""))) {
                throw new SyntaxError("JSON.parse: invalid characters in JSON");
            }
            try { return eval("(" + str + ")"); } // jshint ignore:line
            catch (e) { throw new SyntaxError("JSON.parse: " + e.message); }
        };

        if (typeof JSON === "undefined") { $.global.JSON = J; }
        else {
            if (typeof JSON.parse      !== "function") { JSON.parse      = J.parse; }
            if (typeof JSON.stringify  !== "function") { JSON.stringify  = J.stringify; }
        }
    }());

    // =========================================================================
    // SECTION 3 — PATHS MODULE
    // All file/folder resolution goes through here. No hard-coded paths.
    // `$.fileName` gives us the path of *this* running .jsx file.
    // =========================================================================
    var Paths = (function() {
        var _script = null;    // File object for CemToolbox.jsx
        var _root   = null;    // Folder object for CemToolbox/ sibling dir

        function _init() {
            if (_root) { return true; }

            var fp = $.fileName;
            if (!fp) {
                alert(CT.NAME + ": Cannot determine script path.\n" +
                      "Ensure the file is saved to disk inside Scripts/ScriptUI Panels/.");
                return false;
            }

            _script = new File(fp);
            _root   = new Folder(_script.parent.fsName + "/" + CT.FOLDER);

            if (!_root.exists) {
                if (!_root.create()) {
                    alert(CT.NAME + ": Could not create folder:\n" + _root.fsName);
                    return false;
                }
            }

            // Guarantee all sub-directories exist
            for (var key in CT.DIRS) {
                if (CT.DIRS.hasOwnProperty(key)) {
                    var sub = new Folder(_root.fsName + "/" + CT.DIRS[key]);
                    if (!sub.exists) { sub.create(); }
                }
            }
            return true;
        }

        return {
            init: _init,

            scriptFile: function() { _init(); return _script; },
            root:       function() { _init(); return _root;   },

            /** Returns Folder for a dir key (e.g. "TOOLS") or literal name */
            dir: function(keyOrName) {
                _init();
                if (!_root) { return null; }
                var name = CT.DIRS[keyOrName] || keyOrName;
                return new Folder(_root.fsName + "/" + name);
            },

            /** Returns a File inside the data/ subfolder */
            dataFile: function(fileName) {
                _init();
                if (!_root) { return null; }
                return new File(_root.fsName + "/" + CT.DIRS.DATA + "/" + fileName);
            },

            /**
             * Resolves a tool script path from its manifest `script` field.
             * Accepts paths relative to the CemToolbox/ root,
             * e.g. "tools/my_tool.jsx".
             */
            toolFile: function(scriptPath) {
                _init();
                if (!_root || !scriptPath) { return null; }
                return new File(_root.fsName + "/" + scriptPath.replace(/^\//, ""));
            },

            /** Resolves an icon path relative to CemToolbox/ root */
            iconFile: function(iconPath) {
                _init();
                if (!_root || !iconPath) { return null; }
                return new File(_root.fsName + "/" + iconPath.replace(/^\//, ""));
            }
        };
    }());

    // =========================================================================
    // SECTION 4 — UTILITIES
    // Pure helper functions — no AE or ScriptUI dependencies.
    // =========================================================================
    var Utils = {

        trim: function(s) { return (s || "").replace(/^\s+|\s+$/g, ""); },

        contains: function(hay, needle) {
            return (hay || "").toLowerCase().indexOf((needle || "").toLowerCase()) !== -1;
        },

        padRight: function(s, len) {
            s = String(s || "");
            while (s.length < len) { s += " "; }
            return s;
        },

        /** ISO-8601 timestamp string for logs */
        timestamp: function() {
            var d = new Date();
            function z(n) { return n < 10 ? "0" + n : String(n); }
            return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()) +
                   "T" + z(d.getHours()) + ":" + z(d.getMinutes()) + ":" + z(d.getSeconds());
        },

        /** Read entire text file; returns null on failure */
        readFile: function(file, enc) {
            if (!(file instanceof File) || !file.exists) { return null; }
            try {
                file.encoding = enc || "UTF-8";
                if (!file.open("r")) { return null; }
                var c = file.read();
                file.close();
                return c;
            } catch (e) {
                try { file.close(); } catch (x) {}
                return null;
            }
        },

        /** Write (overwrite) text file; returns bool */
        writeFile: function(file, content, enc) {
            if (!(file instanceof File)) { return false; }
            try {
                file.encoding = enc || "UTF-8";
                if (!file.open("w")) { return false; }
                file.write(content);
                file.close();
                return true;
            } catch (e) {
                try { file.close(); } catch (x) {}
                return false;
            }
        },

        /** Append text to file; returns bool */
        appendFile: function(file, content, enc) {
            if (!(file instanceof File)) { return false; }
            try {
                file.encoding = enc || "UTF-8";
                if (!file.open("a")) { return false; }
                file.write(content);
                file.close();
                return true;
            } catch (e) {
                try { file.close(); } catch (x) {}
                return false;
            }
        },

        /**
         * Recursively collect files matching a suffix pattern inside a Folder.
         * @param {Folder} folder
         * @param {string} suffix  e.g. ".ffx"
         * @returns {File[]}
         */
        collectFiles: function(folder, suffix) {
            var results = [];
            if (!(folder instanceof Folder) || !folder.exists) { return results; }
            var items = folder.getFiles("*");
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                if (item instanceof File) {
                    if (!suffix || item.name.toLowerCase().slice(-suffix.length) === suffix.toLowerCase()) {
                        results.push(item);
                    }
                } else if (item instanceof Folder) {
                    var sub = Utils.collectFiles(item, suffix);
                    for (var j = 0; j < sub.length; j++) { results.push(sub[j]); }
                }
            }
            return results;
        },

        /** ES3-safe Array.indexOf */
        indexOf: function(arr, val) {
            for (var i = 0; i < arr.length; i++) { if (arr[i] === val) { return i; } }
            return -1;
        },

        /** ES3-safe Array.filter */
        filter: function(arr, fn) {
            var r = [];
            for (var i = 0; i < arr.length; i++) { if (fn(arr[i])) { r.push(arr[i]); } }
            return r;
        },

        /** ES3-safe Array.map */
        map: function(arr, fn) {
            var r = [];
            for (var i = 0; i < arr.length; i++) { r.push(fn(arr[i])); }
            return r;
        },

        /** Deep-clone via JSON round-trip (only safe for plain objects) */
        deepClone: function(obj) {
            return JSON.parse(JSON.stringify(obj));
        },

        /**
         * Non-destructive merge of `defaults` with `overrides`.
         * Objects are merged recursively; arrays and primitives are replaced.
         */
        mergeDefaults: function(defaults, overrides) {
            var result = Utils.deepClone(defaults);
            for (var k in overrides) {
                if (!overrides.hasOwnProperty(k)) { continue; }
                if (result.hasOwnProperty(k) &&
                    typeof result[k] === "object" && result[k] !== null &&
                    !(result[k] instanceof Array) &&
                    typeof overrides[k] === "object" && overrides[k] !== null &&
                    !(overrides[k] instanceof Array)) {
                    result[k] = Utils.mergeDefaults(result[k], overrides[k]);
                } else {
                    result[k] = overrides[k];
                }
            }
            return result;
        },

        /** Generate 1-2 letter initials from a title (icon fallback) */
        initials: function(title) {
            var words = (title || "").split(/\s+/);
            var r = "";
            for (var i = 0; i < Math.min(words.length, 2); i++) {
                if (words[i].length > 0) { r += words[i].charAt(0).toUpperCase(); }
            }
            return r || "?";
        }
    };

    // =========================================================================
    // SECTION 5 — STORAGE MODULE
    // Persists user settings to CemToolbox/data/settings.json.
    // JSON file is chosen over app.settings because:
    //   - supports arbitrarily nested structures
    //   - survives AE reinstalls
    //   - human-readable / hand-editable
    // =========================================================================
    var Storage = (function() {
        var _s = null;  // cached settings object

        var DEFAULTS = {
            version           : CT.VERSION,
            devMode           : false,
            confirmDestructive: true,
            lastCategory      : CT.CAT.ALL,
            favorites         : { tools: [], presets: [] },
            extraToolFolders  : [],
            windowSize        : { w: 660, h: 500 }
        };

        function _load() {
            var file = Paths.dataFile(CT.FILES.SETTINGS);
            if (!file || !file.exists) {
                _s = Utils.deepClone(DEFAULTS);
                _flush();
                return;
            }
            var raw = Utils.readFile(file);
            if (!raw) { _s = Utils.deepClone(DEFAULTS); return; }
            try {
                _s = Utils.mergeDefaults(DEFAULTS, JSON.parse(raw));
            } catch (e) {
                _s = Utils.deepClone(DEFAULTS);
            }
        }

        function _flush() {
            var file = Paths.dataFile(CT.FILES.SETTINGS);
            if (!file) { return false; }
            return Utils.writeFile(file, JSON.stringify(_s, null, 2));
        }

        function _ensure() { if (!_s) { _load(); } }

        return {
            load : _load,
            save : _flush,

            get: function(key)        { _ensure(); return _s[key]; },
            set: function(key, value) { _ensure(); _s[key] = value; return _flush(); },

            getAll: function()            { _ensure(); return Utils.deepClone(_s); },
            setAll: function(newSettings) { _s = Utils.mergeDefaults(DEFAULTS, newSettings); return _flush(); },

            // --- Favorites helpers ---
            isFavTool:    function(id)   { _ensure(); return Utils.indexOf(_s.favorites.tools,   id)   !== -1; },
            isFavPreset:  function(path) { _ensure(); return Utils.indexOf(_s.favorites.presets, path) !== -1; },

            toggleFavTool: function(id) {
                _ensure();
                var idx = Utils.indexOf(_s.favorites.tools, id);
                if (idx === -1) { _s.favorites.tools.push(id); }
                else { _s.favorites.tools.splice(idx, 1); }
                return _flush();
            },

            toggleFavPreset: function(path) {
                _ensure();
                var idx = Utils.indexOf(_s.favorites.presets, path);
                if (idx === -1) { _s.favorites.presets.push(path); }
                else { _s.favorites.presets.splice(idx, 1); }
                return _flush();
            }
        };
    }());

    // =========================================================================
    // SECTION 6 — LOGGER MODULE
    // Thread-safe append to log.txt; in-memory ring-buffer for the Console UI.
    // =========================================================================
    var Logger = (function() {
        var _buf        = [];   // ring buffer of { levelNum, levelStr, time, msg }
        var _errCount   = 0;
        var _onErrCb    = null; // callback(totalErrors) fired on each new error

        var LEVEL_STR = ["DEBUG", "INFO ", "WARN ", "ERROR"];

        function _write(levelNum, message) {
            var e = {
                levelNum : levelNum,
                levelStr : LEVEL_STR[levelNum] || "INFO ",
                time     : Utils.timestamp(),
                msg      : String(message || "")
            };
            _buf.push(e);
            if (_buf.length > CT.UI.MAX_LOG_LINES) { _buf.shift(); }

            if (levelNum >= CT.LOG_LEVEL.ERROR) {
                _errCount++;
                if (typeof _onErrCb === "function") {
                    try { _onErrCb(_errCount); } catch (x) {}
                }
            }

            // Write to disk (best-effort; never block AE on failure)
            var logFile = Paths.dataFile(CT.FILES.LOG);
            if (logFile) {
                // Rotate if file is too large
                if (logFile.exists && logFile.length > CT.MAX_LOG_SIZE) {
                    var bak = new File(logFile.fsName + ".bak");
                    if (bak.exists) { bak.remove(); }
                    logFile.rename(logFile.name + ".bak");
                }
                Utils.appendFile(logFile, "[" + e.time + "] [" + e.levelStr + "] " + e.msg + "\n");
            }

            // Mirror to ExtendScript ESTK console in dev mode
            if (Storage.get("devMode")) {
                $.writeln("[" + CT.NAME + "] [" + e.levelStr + "] " + e.msg);
            }
        }

        return {
            setErrorCb    : function(fn) { _onErrCb = fn; },
            getErrorCount : function()   { return _errCount; },
            resetErrors   : function()   { _errCount = 0; },

            debug : function(m) { _write(CT.LOG_LEVEL.DEBUG, m); },
            info  : function(m) { _write(CT.LOG_LEVEL.INFO,  m); },
            warn  : function(m) { _write(CT.LOG_LEVEL.WARN,  m); },
            error : function(m) { _write(CT.LOG_LEVEL.ERROR, m); },

            /** Log a caught exception object with context label */
            exception: function(ctx, e) {
                var m = ctx + ": " + (e && e.message ? e.message : String(e));
                if (e && e.line) { m += " (line " + e.line + ")"; }
                _write(CT.LOG_LEVEL.ERROR, m);
            },

            getRecent: function(n) { return _buf.slice(-(n || 50)); },

            getFormattedLog: function(n) {
                var lines = [];
                var items = this.getRecent(n || CT.UI.MAX_LOG_LINES);
                for (var i = 0; i < items.length; i++) {
                    lines.push("[" + items[i].time + "] [" + items[i].levelStr + "] " + items[i].msg);
                }
                return lines.join("\n");
            },

            clear: function() { _buf = []; _errCount = 0; }
        };
    }());

    // =========================================================================
    // SECTION 7 — MANIFEST MODULE
    // Reads CemToolbox/data/manifest.json and maintains the tool catalogue.
    // =========================================================================
    var Manifest = (function() {
        var _tools      = [];
        var _categories = [];

        var REQUIRED = ["id", "title", "script"];

        function _normalize(raw) {
            return {
                id              : Utils.trim(raw.id      || ""),
                title           : Utils.trim(raw.title   || "Untitled"),
                description     : Utils.trim(raw.description || ""),
                category        : Utils.trim(raw.category    || "Uncategorized"),
                script          : Utils.trim(raw.script  || ""),
                entry           : raw.entry  ? Utils.trim(raw.entry)  : null,
                needsSelection  : !!raw.needsSelection,
                supportsCompOnly: !!raw.supportsCompOnly,
                destructive     : !!raw.destructive,
                icon            : raw.icon   ? Utils.trim(raw.icon)   : null,
                version         : raw.version ? Utils.trim(raw.version) : "1.0.0",
                tags            : (raw.tags instanceof Array) ? raw.tags : []
            };
        }

        function _validate(tool) {
            for (var i = 0; i < REQUIRED.length; i++) {
                if (!tool[REQUIRED[i]]) {
                    Logger.warn("Manifest: tool entry missing '" + REQUIRED[i] + "' — skipped.");
                    return false;
                }
            }
            return true;
        }

        function _load() {
            _tools = [];
            _categories = [];

            var mf = Paths.dataFile(CT.FILES.MANIFEST);
            if (!mf || !mf.exists) {
                Logger.warn("Manifest: manifest.json not found at " +
                            (mf ? mf.fsName : "(unknown)") +
                            " — create it to register tools.");
                return;
            }

            var raw = Utils.readFile(mf);
            if (!raw) { Logger.error("Manifest: Failed to read manifest.json"); return; }

            var data;
            try { data = JSON.parse(raw); }
            catch (e) { Logger.exception("Manifest: JSON parse error", e); return; }

            if (!data.tools || !(data.tools instanceof Array)) {
                Logger.warn("Manifest: No 'tools' array in manifest.json");
                return;
            }

            var catSeen = {};
            for (var i = 0; i < data.tools.length; i++) {
                var t = _normalize(data.tools[i]);
                if (!_validate(t)) { continue; }
                _tools.push(t);
                if (!catSeen[t.category]) {
                    catSeen[t.category] = true;
                    _categories.push(t.category);
                }
            }

            Logger.info("Manifest: " + _tools.length + " tool(s) loaded across " +
                        _categories.length + " categor" + (_categories.length === 1 ? "y" : "ies") + ".");
        }

        return {
            load   : _load,
            reload : function() { _tools = []; _categories = []; _load(); },

            getTools      : function()    { return _tools.slice(); },
            getCategories : function()    { return _categories.slice(); },

            getTool: function(id) {
                for (var i = 0; i < _tools.length; i++) {
                    if (_tools[i].id === id) { return _tools[i]; }
                }
                return null;
            },

            /** Returns tools for a given sidebar category string */
            getByCategory: function(cat) {
                if (!cat || cat === CT.CAT.ALL) { return _tools.slice(); }
                if (cat === CT.CAT.FAVORITES) {
                    var favIds = Storage.get("favorites").tools;
                    return Utils.filter(_tools, function(t) {
                        return Utils.indexOf(favIds, t.id) !== -1;
                    });
                }
                return Utils.filter(_tools, function(t) { return t.category === cat; });
            },

            /**
             * Search tools by query string against title / description / category / tags.
             * If category is given, scopes to that category first.
             */
            search: function(query, cat) {
                var q   = Utils.trim(query).toLowerCase();
                var pool = this.getByCategory(cat);
                if (!q) { return pool; }
                return Utils.filter(pool, function(t) {
                    if (Utils.contains(t.title,       q)) { return true; }
                    if (Utils.contains(t.description, q)) { return true; }
                    if (Utils.contains(t.category,    q)) { return true; }
                    for (var i = 0; i < t.tags.length; i++) {
                        if (Utils.contains(t.tags[i], q)) { return true; }
                    }
                    return false;
                });
            }
        };
    }());

    // =========================================================================
    // SECTION 8 — PRESET MANAGER
    // Recursively scans CemToolbox/presets/ for .ffx files.
    // Applies via AVLayer.applyPreset(File) — the proper AE scripting API.
    // =========================================================================
    var PresetMgr = (function() {
        var _presets = [];  // Array of { name, file, folder }

        function _scan() {
            _presets = [];
            var root = Paths.dir("PRESETS");
            if (!root || !root.exists) {
                Logger.info("PresetMgr: Presets folder not found — drop .ffx files into CemToolbox/presets/");
                return;
            }
            _scanDir(root, root.fsName);
            Logger.info("PresetMgr: Found " + _presets.length + " preset(s).");
        }

        function _scanDir(folder, rootFsName) {
            var items = folder.getFiles("*");
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                if (item instanceof Folder) {
                    _scanDir(item, rootFsName);
                } else if (item instanceof File &&
                           item.name.toLowerCase().slice(-4) === ".ffx") {
                    var relFolder = item.parent.fsName.replace(rootFsName, "").replace(/^[\/\\]/, "");
                    _presets.push({
                        name   : item.name.replace(/\.ffx$/i, ""),
                        file   : item,
                        folder : relFolder || "(root)"
                    });
                }
            }
        }

        return {
            scan   : _scan,
            reload : function() { _presets = []; _scan(); },

            getAll: function()  { return _presets.slice(); },

            getFolders: function() {
                var seen = {}, result = [];
                for (var i = 0; i < _presets.length; i++) {
                    var f = _presets[i].folder;
                    if (!seen[f]) { seen[f] = true; result.push(f); }
                }
                return result.sort();
            },

            search: function(q) {
                q = Utils.trim(q).toLowerCase();
                if (!q) { return _presets.slice(); }
                return Utils.filter(_presets, function(p) {
                    return Utils.contains(p.name, q) || Utils.contains(p.folder, q);
                });
            },

            /**
             * Apply a preset to all selected layers in the active comp.
             * @returns {{ ok:boolean, msg:string }}
             */
            apply: function(preset) {
                var comp = app.project.activeItem;
                if (!(comp instanceof CompItem)) {
                    return { ok: false, msg: "No active composition open." };
                }
                var layers = comp.selectedLayers;
                if (!layers || layers.length === 0) {
                    return { ok: false, msg: "Select at least one layer, then apply." };
                }
                var f = preset.file;
                if (!f.exists) {
                    return { ok: false, msg: "Preset file missing: " + f.fsName };
                }

                var ok = 0, fail = 0;
                for (var i = 0; i < layers.length; i++) {
                    try {
                        layers[i].applyPreset(f);
                        ok++;
                    } catch (e) {
                        Logger.exception("PresetMgr.apply layer " + (i + 1), e);
                        fail++;
                    }
                }

                if (fail === 0) {
                    return { ok: true, msg: "Applied \"" + preset.name + "\" to " + ok + " layer(s)." };
                }
                return { ok: false, msg: "Applied to " + ok + ", failed on " + fail + " layer(s)." };
            }
        };
    }());

    // =========================================================================
    // SECTION 9 — TOOL RUNNER
    // Handles preflight checks, undo group wrapping, and safe eval.
    // =========================================================================
    var ToolRunner = (function() {

        /** Preflight: check comp / selection requirements */
        function _preflight(tool) {
            if (tool.supportsCompOnly || tool.needsSelection) {
                var ai = app.project.activeItem;
                if (!(ai instanceof CompItem)) {
                    return { ok: false, msg: "\"" + tool.title + "\" requires an active composition." };
                }
                if (tool.needsSelection && (!ai.selectedLayers || ai.selectedLayers.length === 0)) {
                    return { ok: false, msg: "\"" + tool.title + "\" requires at least one selected layer." };
                }
            }
            return { ok: true };
        }

        /**
         * Execute the tool file.
         *
         * Mode A — Standalone (no `entry`):
         *   Delegates to $.evalFile() so the tool runs in its own top-level scope
         *   exactly as if the user ran it from File > Scripts.
         *
         * Mode B — Function tool (has `entry`):
         *   Reads source, wraps in an IIFE, captures the named entry function as a
         *   closure (preserving its private scope), then calls it.  This prevents
         *   top-level symbol leakage into the panel engine.
         */
        function _exec(tool) {
            var tf = Paths.toolFile(tool.script);
            if (!tf) { return { ok: false, msg: "Cannot resolve path for: " + tool.script }; }
            if (!tf.exists) {
                return { ok: false, msg: "Script not found: " + tf.fsName };
            }

            if (!tool.entry) {
                // ---- Mode A: Standalone ----
                try {
                    $.evalFile(tf);
                    return { ok: true };
                } catch (e) {
                    return { ok: false, error: e, msg: e.message || String(e) };
                }
            }

            // ---- Mode B: Function tool ----
            var src = Utils.readFile(tf);
            if (src === null) { return { ok: false, msg: "Cannot read: " + tf.fsName }; }

            // Wrap in IIFE; return the named entry function so we can call it outside
            var wrapped = "(function(){\n" + src +
                          "\n; return (typeof " + tool.entry +
                          " === 'function') ? " + tool.entry + " : null;\n}())";
            var entryFn;
            try {
                entryFn = eval(wrapped); // jshint ignore:line
            } catch (e) {
                return { ok: false, error: e, msg: "Load error: " + e.message };
            }

            if (typeof entryFn !== "function") {
                // Entry not found — fall back to standalone eval
                Logger.warn("ToolRunner: entry '" + tool.entry +
                            "' not found in " + tool.id + ", running standalone.");
                try {
                    $.evalFile(tf);
                    return { ok: true };
                } catch (e) {
                    return { ok: false, error: e, msg: e.message || String(e) };
                }
            }

            try {
                var result = entryFn();
                return { ok: true, result: result };
            } catch (e) {
                return { ok: false, error: e, msg: e.message || String(e) };
            }
        }

        return {
            /**
             * Public run method.
             * Runs preflight → optional destructive confirm → undo group → exec.
             * @returns {{ ok:boolean, msg:string }}
             */
            run: function(tool) {
                if (!tool) { return { ok: false, msg: "No tool specified." }; }

                var pre = _preflight(tool);
                if (!pre.ok) { return pre; }

                if (tool.destructive && Storage.get("confirmDestructive")) {
                    if (!confirm("\"" + tool.title + "\" may make irreversible changes.\nProceed?")) {
                        return { ok: false, msg: "Cancelled." };
                    }
                }

                app.beginUndoGroup(CT.NAME + ": " + tool.title);
                var res;
                try {
                    Logger.info("Run: " + tool.id + " v" + tool.version);
                    res = _exec(tool);
                } catch (e) {
                    res = { ok: false, error: e, msg: "Unexpected error: " + (e.message || e) };
                } finally {
                    app.endUndoGroup();
                }

                if (res.ok) {
                    Logger.info("Done: " + tool.id);
                } else {
                    Logger.exception("ToolRunner [" + tool.id + "]", res.error || { message: res.msg });
                }
                return res;
            }
        };
    }());

    // =========================================================================
    // SECTION 10 — SHARED UI STATE
    // A plain object that holds the current view state.  All UI event handlers
    // read from / write to this object, then call refresh functions.
    // =========================================================================
    var State = {
        searchQuery    : "",
        currentCat     : CT.CAT.ALL,
        selectedTool   : null,   // tool object or null
        selectedPreset : null,   // preset object or null
        showingPresets : false   // true = presets panel visible
    };

    // =========================================================================
    // SECTION 11 — SETTINGS DIALOG
    // A modal Window for user preferences.
    // =========================================================================
    function showSettingsDialog(panel) {
        var s    = Storage.getAll();
        var dlg  = new Window("dialog", CT.NAME + " — Settings");
        dlg.orientation   = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing       = 10;
        dlg.margins       = 18;

        // --- Dev Mode ---
        var devCb = dlg.add("checkbox", undefined, "Developer Mode  (shows Reload button & debug output)");
        devCb.value = s.devMode;

        // --- Confirm Destructive ---
        var confCb = dlg.add("checkbox", undefined, "Confirm before running tools marked as destructive");
        confCb.value = s.confirmDestructive;

        // --- Extra tool folders (informational for now) ---
        var folderGrp = dlg.add("panel", undefined, "Additional Tool Folders");
        folderGrp.orientation   = "column";
        folderGrp.alignChildren = ["fill", "top"];
        folderGrp.margins       = [10, 14, 10, 10];

        var folderNote = folderGrp.add("statictext", undefined,
            "Add folder paths (one per line) to load tools from extra locations.\n" +
            "This feature is reserved for a future release.",
            { multiline: true });
        folderNote.alignment    = ["fill", "top"];
        folderNote.preferredSize = [-1, 44];

        // --- Clear log ---
        var clearBtn = dlg.add("button", undefined, "Clear Error Log");
        clearBtn.helpTip = "Removes all entries from the in-memory log and log.txt";

        // --- Buttons ---
        var btnRow = dlg.add("group");
        btnRow.alignment = ["right", "bottom"];
        var okBtn     = btnRow.add("button", undefined, "OK",     { name: "ok"     });
        var cancelBtn = btnRow.add("button", undefined, "Cancel", { name: "cancel" });

        clearBtn.onClick = function() {
            Logger.clear();
            var lf = Paths.dataFile(CT.FILES.LOG);
            if (lf && lf.exists) { Utils.writeFile(lf, ""); }
            alert("Log cleared.");
        };

        okBtn.onClick = function() {
            Storage.set("devMode",            devCb.value);
            Storage.set("confirmDestructive", confCb.value);
            dlg.close(1);
        };

        cancelBtn.onClick = function() { dlg.close(0); };

        return dlg.show();
    }

    // =========================================================================
    // SECTION 12 — CONSOLE / LOG VIEWER DIALOG
    // Shows recent log lines; refreshes on open.
    // =========================================================================
    function showConsoleDialog() {
        var dlg = new Window("dialog", CT.NAME + " — Console");
        dlg.orientation   = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing       = 8;
        dlg.margins       = 12;
        dlg.preferredSize = [580, 360];

        var logText = dlg.add("edittext", undefined, "", {
            multiline : true,
            readonly  : true,
            scrollable: true
        });
        logText.alignment    = ["fill", "fill"];
        logText.preferredSize = [560, 290];

        // Monospace font attempt (not guaranteed on all platforms)
        try {
            logText.graphics.font = ScriptUI.newFont("Courier New", "REGULAR", 11);
        } catch (e) {}

        logText.text = Logger.getFormattedLog(CT.UI.MAX_LOG_LINES) || "(no log entries yet)";

        var row = dlg.add("group");
        row.alignment = ["fill", "bottom"];
        var spacer = row.add("group"); spacer.alignment = ["fill", "center"];
        var refreshBtn = row.add("button", undefined, "Refresh");
        var clearBtn   = row.add("button", undefined, "Clear Log");
        var closeBtn   = row.add("button", undefined, "Close", { name: "cancel" });

        refreshBtn.onClick = function() {
            logText.text = Logger.getFormattedLog(CT.UI.MAX_LOG_LINES) || "(empty)";
        };
        clearBtn.onClick = function() {
            Logger.clear();
            var lf = Paths.dataFile(CT.FILES.LOG);
            if (lf && lf.exists) { Utils.writeFile(lf, ""); }
            logText.text = "(log cleared)";
        };
        closeBtn.onClick = function() { dlg.close(); };

        dlg.show();
    }

    // =========================================================================
    // SECTION 13 — MAIN PANEL BUILDER
    // Assembles the full ScriptUI hierarchy and wires all event handlers.
    // =========================================================================
    function buildPanel(container) {

        // ---- Initialise all modules ----
        Paths.init();
        Storage.load();
        State.currentCat = Storage.get("lastCategory") || CT.CAT.ALL;
        Manifest.load();
        PresetMgr.scan();

        // ---- Panel root ----
        var panel = (container instanceof Panel)
            ? container
            : new Window("palette", CT.NAME, undefined, { resizeable: true });

        panel.orientation   = "column";
        panel.alignChildren = ["fill", "top"];
        panel.spacing       = 4;
        panel.margins       = [4, 6, 4, 4];

        // ==============================================================
        // TOP BAR
        // ==============================================================
        var topBar = panel.add("group");
        topBar.orientation   = "row";
        topBar.alignChildren = ["left", "center"];
        topBar.spacing       = 6;
        topBar.margins       = [2, 2, 2, 0];
        topBar.alignment     = ["fill", "top"];

        var titleLbl = topBar.add("statictext", undefined, CT.NAME + "  v" + CT.VERSION);
        try {
            titleLbl.graphics.font = ScriptUI.newFont("Arial", "BOLD", 13);
        } catch (e) {}

        // Flexible spacer
        var tSpacer = topBar.add("group");
        tSpacer.alignment = ["fill", "center"];

        // Search
        var searchLbl = topBar.add("statictext", undefined, "Search:");
        var searchFld = topBar.add("edittext",   undefined, "");
        searchFld.preferredSize = [150, 22];
        searchFld.helpTip       = "Filter tools and presets (type to search)";

        // Dev-mode Reload button (hidden by default)
        var reloadBtn = topBar.add("button", undefined, "Reload");
        reloadBtn.preferredSize = [54, 22];
        reloadBtn.helpTip       = "Re-read manifest.json and rescan presets (Dev Mode)";
        reloadBtn.visible       = Storage.get("devMode");

        // Console button
        var consoleBtn = topBar.add("button", undefined, "Console");
        consoleBtn.preferredSize = [58, 22];
        consoleBtn.helpTip       = "Open the log/console viewer";

        // Settings button
        var settingsBtn = topBar.add("button", undefined, "Settings");
        settingsBtn.preferredSize = [58, 22];
        settingsBtn.helpTip       = "Open settings";

        // ==============================================================
        // MAIN BODY  (sidebar | content)
        // ==============================================================
        var body = panel.add("group");
        body.orientation   = "row";
        body.alignChildren = ["fill", "fill"];
        body.alignment     = ["fill", "fill"];
        body.spacing       = 4;
        body.margins       = 0;

        // ---- LEFT SIDEBAR ----
        var sidebar = body.add("group");
        sidebar.orientation   = "column";
        sidebar.alignChildren = ["fill", "top"];
        sidebar.alignment     = ["left", "fill"];
        sidebar.spacing       = 4;
        sidebar.margins       = [0, 0, 2, 0];
        sidebar.preferredSize = [CT.UI.SIDEBAR_W, -1];

        var catLbl = sidebar.add("statictext", undefined, "CATEGORIES");
        try { catLbl.graphics.font = ScriptUI.newFont("Arial", "BOLD", 10); } catch (e) {}

        var catList = sidebar.add("listbox", undefined, []);
        catList.alignment    = ["fill", "fill"];
        catList.preferredSize = [CT.UI.SIDEBAR_W - 4, -1];
        catList.helpTip      = "Select a category to filter tools";

        // ---- RIGHT CONTENT AREA (stack: tools view  OR  presets view) ----
        var content = body.add("group");
        content.orientation   = "stack";
        content.alignChildren = ["fill", "fill"];
        content.alignment     = ["fill", "fill"];
        content.margins       = 0;

        // --- TOOLS VIEW ---
        var toolsView = content.add("group");
        toolsView.orientation   = "column";
        toolsView.alignChildren = ["fill", "top"];
        toolsView.alignment     = ["fill", "fill"];
        toolsView.spacing       = 4;
        toolsView.margins       = 0;

        // Tool list (2-column: Title  |  Description)
        var toolList = toolsView.add("listbox", undefined, [], {
            numberOfColumns: 2,
            showHeaders    : true,
            columnTitles   : ["Tool", "Description"],
            columnWidths   : [180, 290]
        });
        toolList.alignment    = ["fill", "fill"];
        toolList.preferredSize = [-1, -1];
        toolList.helpTip      = "Select a tool. Double-click or press Run to execute.";

        // Detail + action bar (below the list)
        var toolActions = toolsView.add("group");
        toolActions.orientation   = "row";
        toolActions.alignChildren = ["left", "center"];
        toolActions.alignment     = ["fill", "bottom"];
        toolActions.spacing       = 6;
        toolActions.margins       = [0, 2, 0, 0];

        var toolDetailLbl = toolActions.add("statictext", undefined, "Select a tool above.");
        toolDetailLbl.alignment     = ["fill", "center"];
        toolDetailLbl.preferredSize = [-1, 30];
        try {
            var boundsGroup = toolActions.add("group");
            boundsGroup.alignment = ["left", "center"];
        } catch (e) {}

        var favToolBtn = toolActions.add("button", undefined, "\u2606 Fav");
        favToolBtn.preferredSize = [52, 24];
        favToolBtn.helpTip       = "Toggle favourite";
        favToolBtn.enabled       = false;

        var runBtn = toolActions.add("button", undefined, "Run \u25B6");
        runBtn.preferredSize = [68, 26];
        runBtn.helpTip       = "Run selected tool";
        runBtn.enabled       = false;

        // --- PRESETS VIEW ---
        var presetsView = content.add("group");
        presetsView.orientation   = "column";
        presetsView.alignChildren = ["fill", "top"];
        presetsView.alignment     = ["fill", "fill"];
        presetsView.spacing       = 4;
        presetsView.margins       = 0;
        presetsView.visible       = false;  // hidden initially

        var presetSearchRow = presetsView.add("group");
        presetSearchRow.orientation   = "row";
        presetSearchRow.alignChildren = ["left", "center"];
        presetSearchRow.alignment     = ["fill", "top"];
        var presetSearchLbl = presetSearchRow.add("statictext", undefined, "Filter presets:");
        var presetSearchFld = presetSearchRow.add("edittext", undefined, "");
        presetSearchFld.alignment    = ["fill", "center"];
        presetSearchFld.preferredSize = [-1, 22];

        var presetList = presetsView.add("listbox", undefined, [], {
            numberOfColumns: 2,
            showHeaders    : true,
            columnTitles   : ["Preset Name", "Folder"],
            columnWidths   : [230, 220]
        });
        presetList.alignment    = ["fill", "fill"];
        presetList.preferredSize = [-1, -1];
        presetList.helpTip      = "Select a preset. Double-click or press Apply to apply to selected layers.";

        var presetActions = presetsView.add("group");
        presetActions.orientation   = "row";
        presetActions.alignChildren = ["left", "center"];
        presetActions.alignment     = ["fill", "bottom"];
        presetActions.spacing       = 6;
        presetActions.margins       = [0, 2, 0, 0];

        var presetDetailLbl = presetActions.add("statictext", undefined, "Select a preset above.");
        presetDetailLbl.alignment = ["fill", "center"];

        var favPresetBtn = presetActions.add("button", undefined, "\u2606 Fav");
        favPresetBtn.preferredSize = [52, 24];
        favPresetBtn.helpTip       = "Toggle favourite";
        favPresetBtn.enabled       = false;

        var applyBtn = presetActions.add("button", undefined, "Apply \u25B6");
        applyBtn.preferredSize = [68, 26];
        applyBtn.helpTip       = "Apply preset to selected layers";
        applyBtn.enabled       = false;

        // ==============================================================
        // STATUS BAR
        // ==============================================================
        var statusBar = panel.add("group");
        statusBar.orientation   = "row";
        statusBar.alignChildren = ["left", "center"];
        statusBar.alignment     = ["fill", "bottom"];
        statusBar.spacing       = 8;
        statusBar.margins       = [2, 2, 2, 2];
        statusBar.preferredSize = [-1, CT.UI.STATUS_H];

        var statusLbl = statusBar.add("statictext", undefined, "Ready.");
        statusLbl.alignment    = ["fill", "center"];
        statusLbl.preferredSize = [-1, CT.UI.STATUS_H];

        var errLbl = statusBar.add("statictext", undefined, "Errors: 0");
        errLbl.alignment = ["right", "center"];
        errLbl.helpTip   = "Click Console button to view error details";

        // ==============================================================
        // HELPER: update status bar text
        // ==============================================================
        function setStatus(msg, isError) {
            try {
                statusLbl.text = msg || "Ready.";
                errLbl.text    = "Errors: " + Logger.getErrorCount();
            } catch (e) {}
        }

        // Register error callback so status bar updates automatically
        Logger.setErrorCb(function(count) {
            try { errLbl.text = "Errors: " + count; } catch (e) {}
        });

        // ==============================================================
        // HELPER: rebuild the category sidebar list
        // ==============================================================
        function refreshSidebar() {
            catList.removeAll();

            var cats = [CT.CAT.ALL, CT.CAT.FAVORITES];
            var dynCats = Manifest.getCategories();
            for (var i = 0; i < dynCats.length; i++) { cats.push(dynCats[i]); }
            cats.push(CT.CAT.PRESETS);

            for (var j = 0; j < cats.length; j++) {
                var item = catList.add("item", cats[j]);
                if (cats[j] === State.currentCat) { catList.selection = item; }
            }

            // Fallback selection
            if (!catList.selection && catList.items.length > 0) {
                catList.selection = catList.items[0];
                State.currentCat  = catList.items[0].text;
            }
        }

        // ==============================================================
        // HELPER: rebuild the tools listbox for current state
        // ==============================================================
        function refreshToolList() {
            toolList.removeAll();
            State.selectedTool = null;
            runBtn.enabled     = false;
            favToolBtn.enabled = false;
            toolDetailLbl.text = "Select a tool above.";

            var tools = Manifest.search(State.searchQuery, State.currentCat);

            for (var i = 0; i < tools.length; i++) {
                var t = tools[i];
                // Star prefix for favourites
                var prefix = Storage.isFavTool(t.id) ? "\u2605 " : "   ";
                var item   = toolList.add("item", prefix + t.title);
                item.subItems[0].text = t.description;
                // Store reference on the item for retrieval in click handler
                item._toolId = t.id;
            }

            if (tools.length === 0) {
                var empty = toolList.add("item", "(no tools found)");
                empty.subItems[0].text = "Adjust your search or add tools to the manifest.";
                empty._toolId = null;
            }
        }

        // ==============================================================
        // HELPER: rebuild the presets listbox
        // ==============================================================
        function refreshPresetList() {
            presetList.removeAll();
            State.selectedPreset  = null;
            applyBtn.enabled      = false;
            favPresetBtn.enabled  = false;
            presetDetailLbl.text  = "Select a preset above.";

            var presets = PresetMgr.search(presetSearchFld.text);

            for (var i = 0; i < presets.length; i++) {
                var p    = presets[i];
                var star = Storage.isFavPreset(p.file.fsName) ? "\u2605 " : "   ";
                var item = presetList.add("item", star + p.name);
                item.subItems[0].text = p.folder;
                item._preset = p;
            }

            if (presets.length === 0) {
                var empty = presetList.add("item", "(no presets found)");
                empty.subItems[0].text = "Drop .ffx files into CemToolbox/presets/";
                empty._preset = null;
            }
        }

        // ==============================================================
        // HELPER: switch content view (tools or presets)
        // ==============================================================
        function showView(cat) {
            var isPresets = (cat === CT.CAT.PRESETS);
            State.showingPresets = isPresets;
            toolsView.visible    = !isPresets;
            presetsView.visible  =  isPresets;
            try { panel.layout.layout(true); } catch (e) {}
        }

        // ==============================================================
        // HELPER: full refresh (called after reload)
        // ==============================================================
        function fullRefresh() {
            Manifest.reload();
            PresetMgr.reload();
            refreshSidebar();
            if (State.showingPresets) {
                refreshPresetList();
            } else {
                refreshToolList();
            }
            setStatus("Reloaded manifest and presets.");
        }

        // ==============================================================
        // EVENT: search field changed
        // ==============================================================
        searchFld.onChanging = function() {
            State.searchQuery = Utils.trim(searchFld.text);
            if (State.showingPresets) {
                presetSearchFld.text = State.searchQuery;
                refreshPresetList();
            } else {
                refreshToolList();
            }
        };

        // ==============================================================
        // EVENT: category list selection changed
        // ==============================================================
        catList.onChange = function() {
            if (!catList.selection) { return; }
            var cat = catList.selection.text;
            State.currentCat = cat;
            Storage.set("lastCategory", cat);
            showView(cat);
            if (cat === CT.CAT.PRESETS) {
                refreshPresetList();
            } else {
                refreshToolList();
            }
            setStatus("Category: " + cat);
        };

        // ==============================================================
        // EVENT: tool list selection changed
        // ==============================================================
        toolList.onChange = function() {
            if (!toolList.selection || !toolList.selection._toolId) {
                State.selectedTool = null;
                runBtn.enabled     = false;
                favToolBtn.enabled = false;
                toolDetailLbl.text = "Select a tool above.";
                return;
            }
            var tool = Manifest.getTool(toolList.selection._toolId);
            State.selectedTool = tool;
            if (tool) {
                runBtn.enabled     = true;
                favToolBtn.enabled = true;
                var isFav = Storage.isFavTool(tool.id);
                favToolBtn.text = isFav ? "\u2605 Fav" : "\u2606 Fav";

                var flags = [];
                if (tool.supportsCompOnly) { flags.push("comp required"); }
                if (tool.needsSelection)   { flags.push("selection required"); }
                if (tool.destructive)      { flags.push("destructive"); }
                var flagStr = flags.length > 0 ? "  [" + flags.join(", ") + "]" : "";
                toolDetailLbl.text = tool.description + flagStr;
            }
        };

        // ==============================================================
        // EVENT: run button / double-click tool list
        // ==============================================================
        function doRunSelectedTool() {
            if (!State.selectedTool) { setStatus("No tool selected."); return; }
            setStatus("Running: " + State.selectedTool.title + " ...");
            try { panel.update(); } catch (e) {}  // Force UI repaint

            var res = ToolRunner.run(State.selectedTool);
            if (res.ok) {
                setStatus("Done: " + State.selectedTool.title);
            } else {
                setStatus("Error: " + res.msg, true);
                if (!res.msg.match(/Cancelled/)) {
                    alert(CT.NAME + " \u2014 Error\n\n" + res.msg +
                          "\n\nDetails in Console log.");
                }
            }
        }

        runBtn.onClick  = doRunSelectedTool;
        toolList.onDoubleClick = doRunSelectedTool;

        // ==============================================================
        // EVENT: favourite tool toggle
        // ==============================================================
        favToolBtn.onClick = function() {
            if (!State.selectedTool) { return; }
            Storage.toggleFavTool(State.selectedTool.id);
            var isFav = Storage.isFavTool(State.selectedTool.id);
            favToolBtn.text = isFav ? "\u2605 Fav" : "\u2606 Fav";
            refreshToolList();
            // Restore selection (find the item again after refresh)
            if (State.selectedTool) {
                for (var i = 0; i < toolList.items.length; i++) {
                    if (toolList.items[i]._toolId === State.selectedTool.id) {
                        toolList.selection = toolList.items[i];
                        break;
                    }
                }
            }
            setStatus((isFav ? "Added to" : "Removed from") + " favourites: " + State.selectedTool.title);
        };

        // ==============================================================
        // EVENT: preset list selection
        // ==============================================================
        presetList.onChange = function() {
            if (!presetList.selection || !presetList.selection._preset) {
                State.selectedPreset = null;
                applyBtn.enabled     = false;
                favPresetBtn.enabled = false;
                presetDetailLbl.text = "Select a preset above.";
                return;
            }
            var p = presetList.selection._preset;
            State.selectedPreset = p;
            applyBtn.enabled     = true;
            favPresetBtn.enabled = true;
            var isFav = Storage.isFavPreset(p.file.fsName);
            favPresetBtn.text    = isFav ? "\u2605 Fav" : "\u2606 Fav";
            presetDetailLbl.text = p.folder + "/" + p.name + ".ffx";
        };

        // ==============================================================
        // EVENT: apply preset button / double-click
        // ==============================================================
        function doApplyPreset() {
            if (!State.selectedPreset) { setStatus("No preset selected."); return; }
            app.beginUndoGroup(CT.NAME + ": Apply Preset " + State.selectedPreset.name);
            var res;
            try {
                res = PresetMgr.apply(State.selectedPreset);
            } catch (e) {
                res = { ok: false, msg: e.message || String(e) };
                Logger.exception("Apply preset", e);
            } finally {
                app.endUndoGroup();
            }
            setStatus(res.msg, !res.ok);
            if (!res.ok) { alert(CT.NAME + "\n\n" + res.msg); }
        }

        applyBtn.onClick = doApplyPreset;
        presetList.onDoubleClick = doApplyPreset;

        // ==============================================================
        // EVENT: favourite preset toggle
        // ==============================================================
        favPresetBtn.onClick = function() {
            if (!State.selectedPreset) { return; }
            var fp = State.selectedPreset.file.fsName;
            Storage.toggleFavPreset(fp);
            var isFav = Storage.isFavPreset(fp);
            favPresetBtn.text = isFav ? "\u2605 Fav" : "\u2606 Fav";
            refreshPresetList();
            setStatus((isFav ? "Added to" : "Removed from") + " favourites: " + State.selectedPreset.name);
        };

        // ==============================================================
        // EVENT: preset search field
        // ==============================================================
        presetSearchFld.onChanging = function() {
            refreshPresetList();
        };

        // ==============================================================
        // EVENT: Reload button
        // ==============================================================
        reloadBtn.onClick = function() {
            setStatus("Reloading...");
            fullRefresh();
        };

        // ==============================================================
        // EVENT: Console button
        // ==============================================================
        consoleBtn.onClick = function() {
            showConsoleDialog();
        };

        // ==============================================================
        // EVENT: Settings button
        // ==============================================================
        settingsBtn.onClick = function() {
            var result = showSettingsDialog(panel);
            // Update reload button visibility based on new devMode setting
            reloadBtn.visible = Storage.get("devMode");
            try { panel.layout.layout(true); } catch (e) {}
            setStatus("Settings saved.");
        };

        // ==============================================================
        // RESIZE support (docked panel)
        // ==============================================================
        panel.onResizing = panel.onResize = function() {
            try { this.layout.resize(); } catch (e) {}
        };

        // ==============================================================
        // INITIAL RENDER
        // ==============================================================
        refreshSidebar();
        showView(State.currentCat);
        if (State.showingPresets) {
            refreshPresetList();
        } else {
            refreshToolList();
        }

        setStatus("Ready. " + Manifest.getTools().length + " tool(s) | " +
                  PresetMgr.getAll().length + " preset(s) loaded.");
        Logger.info(CT.NAME + " v" + CT.VERSION + " panel initialised.");

        // Show as floating window if not docked
        if (!(container instanceof Panel)) {
            panel.center();
            panel.show();
        }

        return panel;
    }

    // =========================================================================
    // SECTION 14 — INIT
    // =========================================================================
    buildPanel(thisObj);

}(this));
// End of CemToolbox.jsx
