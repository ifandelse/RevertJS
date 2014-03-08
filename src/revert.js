(function(root, factory) {
    if (typeof module === "object" && module.exports) {
        // Node, or CommonJS-Like environments
        module.exports = function() {
            var gnosis = require("gnosis");
            return factory(gnosis);
        };
    } else if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define(["gnosis"], function(gnosis) {
            return factory(gnosis);
        });
    } else {
        // Browser globals
        root.revertjs = factory(root.gnosis);
    }
}(this, function(gnosis, undefined) {

    var exclude = gnosis.traverse.exclude;
    exclude.splice(exclude.length, 0, "undo", "redo", "__changes__", "__inProgress__", "__position__", "__addHistory__");

    var punchMutator = function(target, key, val, kind, path, root) {
        var oldMut = target[key];
        target[key] = function() {
            var oldVal = Undoable.clone(target);
            oldMut.apply(target, arguments);
            root.__addHistory__({
                changeType: "mutation",
                path: path.slice(0, path.length - key.length - 1),
                oldVal: oldVal,
                newVal: Undoable.clone(target)
            });
            root.rescan();
        };
    };

    var punchProperty = function(target, key, val, kind, path, root) {
        var _val = val;
        Object.defineProperty(target, key, {
            enumerable: true,
            configurable: true,
            get: function() {
                return _val;
            },
            set: function(x) {
                var oldVal = Undoable.clone(_val);
                var oldType = gnosis.getType(oldVal);
                var newType = gnosis.getType(x);
                _val = x;
                root.__addHistory__({
                    changeType: "assignment",
                    path: path,
                    oldVal: oldVal,
                    newVal: Undoable.clone(x)
                });
                if (oldType !== newType || newType === "object" || newType === "array") {
                    root.rescan();
                }
            }
        });
    };

    var Undoable = function(target, options, rootNs) {
        var prop;
        for (var prop in target) {
            if (options.allTargetMembers || target.hasOwnProperty(prop)) {
                this[prop] = target[prop];
            }
        }
        var transformFn = function(target, key, val, kind, path, root) {
            if (kind === "function" && gnosis.getType(target) === "array" && gnosis.traverse.arrayMembers.indexOf(key) !== -1) {
                punchMutator(target, key, val, kind, path, root);
            } else if (kind !== "function") {
                punchProperty(target, key, val, kind, path, root);
            }
        };
        gnosis.traverse(this, transformFn, options, rootNs);
        this.__changes__ = [];
        this.__position__ = 0;
        this.__inProgress__ = false;
    };

    // The intent here is to override default clone
    // with a more substantial implementation. While
    // cloning is essential, it's not something that
    // has to be re-invented for RevertJS to work.
    Undoable.clone = function(obj) {
        return JSON.parse(JSON.stringify(obj));
    };

    Undoable.prototype.__addHistory__ = function(x) {
        if (this.__inProgress__) {
            return;
        }
        if (this.__position__ !== this.__changes__.length - 1) {
            this.__changes__ = this.__changes__.slice(0, this.__position__);
        }
        this.__changes__.push(x);
        this.__position__ = this.__changes__.length - 1;
    };

    var canApplyChange = function(nexPos) {
        return nexPos >= 0 &&
            nexPos < this.__changes__.length
    };

    var applyChange = function(kind) {
        var change = this.__changes__[this.__position__];
        setFn = change.changeType === "mutation" ? function(target, val) {
            var args = [0, target.length].concat(Undoable.clone(val));
            Array.prototype.splice.apply(target, args);
        } : undefined;
        gnosis.setValFromPath(
            this,
            change.path,
            Undoable.clone((kind === "undo") ? change.oldVal : change.newVal),
            setFn
        );
    };

    Undoable.prototype.undo = function(x) {
        x = x || 1;
        this.__inProgress__ = true;
        while (x > 0 && canApplyChange.call(this, this.__position__)) {
            applyChange.call(this, "undo");
            this.__position__ -= 1;
            x -= 1;
        }
        this.__inProgress__ = false;
    };

    Undoable.prototype.redo = function(x) {
        x = x || 1;
        this.__inProgress__ = true;
        while (x > 0 && canApplyChange.call(this, this.__position__ + 1)) {
            this.__position__ += 1;
            applyChange.call(this, "redo");
            x -= 1;
        }
        this.__inProgress__ = false;
    };

    return {
        Undoable: Undoable
    }

}));