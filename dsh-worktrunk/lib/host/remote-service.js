var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { createWorktrunkService } from './service.js';
import { createWorktrunkRemoteProjection } from './remote.js';
/**
 * Composition root for the browser half. Cordis constructs it, which registers
 * the `worktrunkManager` Typert namespace and binds the service to this fiber's
 * lifetime. The decorated methods stay deliberately thin: projection and error
 * normalization live in `createWorktrunkRemoteProjection`.
 */
let WorktrunkRemoteService = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _readPanel_decorators;
    let _previewHooks_decorators;
    let _createWorktree_decorators;
    let _removeWorktree_decorators;
    let _mergeWorktree_decorators;
    let _copyIgnored_decorators;
    let _openWorktree_decorators;
    let _ensureWorktreePermission_decorators;
    return class WorktrunkRemoteService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _readPanel_decorators = [Remote];
            _previewHooks_decorators = [Remote];
            _createWorktree_decorators = [Remote];
            _removeWorktree_decorators = [Remote];
            _mergeWorktree_decorators = [Remote];
            _copyIgnored_decorators = [Remote];
            _openWorktree_decorators = [Remote];
            _ensureWorktreePermission_decorators = [Remote];
            __esDecorate(this, null, _readPanel_decorators, { kind: "method", name: "readPanel", static: false, private: false, access: { has: obj => "readPanel" in obj, get: obj => obj.readPanel }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _previewHooks_decorators, { kind: "method", name: "previewHooks", static: false, private: false, access: { has: obj => "previewHooks" in obj, get: obj => obj.previewHooks }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _createWorktree_decorators, { kind: "method", name: "createWorktree", static: false, private: false, access: { has: obj => "createWorktree" in obj, get: obj => obj.createWorktree }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _removeWorktree_decorators, { kind: "method", name: "removeWorktree", static: false, private: false, access: { has: obj => "removeWorktree" in obj, get: obj => obj.removeWorktree }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _mergeWorktree_decorators, { kind: "method", name: "mergeWorktree", static: false, private: false, access: { has: obj => "mergeWorktree" in obj, get: obj => obj.mergeWorktree }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _copyIgnored_decorators, { kind: "method", name: "copyIgnored", static: false, private: false, access: { has: obj => "copyIgnored" in obj, get: obj => obj.copyIgnored }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _openWorktree_decorators, { kind: "method", name: "openWorktree", static: false, private: false, access: { has: obj => "openWorktree" in obj, get: obj => obj.openWorktree }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _ensureWorktreePermission_decorators, { kind: "method", name: "ensureWorktreePermission", static: false, private: false, access: { has: obj => "ensureWorktreePermission" in obj, get: obj => obj.ensureWorktreePermission }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['subprocess'];
        remote = __runInitializers(this, _instanceExtraInitializers);
        constructor(ctx, config) {
            super(ctx, 'worktrunkManager');
            const service = createWorktrunkService(ctx, config);
            this.remote = createWorktrunkRemoteProjection(service);
        }
        readPanel(input) {
            return this.remote.readPanel(input);
        }
        previewHooks(input) {
            return this.remote.previewHooks(input);
        }
        createWorktree(input) {
            return this.remote.createWorktree(input);
        }
        removeWorktree(input) {
            return this.remote.removeWorktree(input);
        }
        mergeWorktree(input) {
            return this.remote.mergeWorktree(input);
        }
        copyIgnored(input) {
            return this.remote.copyIgnored(input);
        }
        openWorktree(input) {
            return this.remote.openWorktree(input);
        }
        ensureWorktreePermission(input) {
            return this.remote.ensureWorktreePermission(input);
        }
    };
})();
export { WorktrunkRemoteService };
