/** The one logical channel shared by the DSH Connection and Typert Gateway. */
export const WORKTRUNK_CHANNEL = '/api';
/** Canonical endpoints owned by this adapter. */
export const WORKTRUNK_ENDPOINTS = Object.freeze({
    readPanel: 'worktrunkManager/readPanel',
    previewHooks: 'worktrunkManager/previewHooks',
    createWorktree: 'worktrunkManager/createWorktree',
    removeWorktree: 'worktrunkManager/removeWorktree',
    mergeWorktree: 'worktrunkManager/mergeWorktree',
    copyIgnored: 'worktrunkManager/copyIgnored',
    openWorktree: 'worktrunkManager/openWorktree',
    ensureWorktreePermission: 'worktrunkManager/ensureWorktreePermission',
});
/** Browser-safe error shared by transport, gateway, and domain failures. */
export class WorktrunkConnectionError extends Error {
    code;
    details;
    retryable;
    constructor(options) {
        super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
        this.name = 'WorktrunkConnectionError';
        this.code = options.code;
        this.details = Object.freeze({ ...(options.details ?? {}) });
        this.retryable = options.retryable;
    }
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function asEnvelope(value) {
    if (isRecord(value) && typeof value.ok === 'boolean')
        return value;
    return { ok: false, error: { code: 'WORKTRUNK_INVALID_RESULT', message: '', details: {} } };
}
/** Adapt the shared DSH Connection RPC into the panel contract. */
export function createWorktrunkConnection(rpc) {
    const inFlight = new Set();
    let disposed = false;
    async function invoke(endpoint, input) {
        if (disposed)
            throw new WorktrunkConnectionError({ code: 'CLIENT_DISPOSED', message: 'Worktrunk connection is disposed; reload the plugin and retry.', retryable: false });
        const controller = new AbortController();
        inFlight.add(controller);
        try {
            let raw;
            try {
                raw = await rpc.call(WORKTRUNK_CHANNEL, endpoint, { args: { input } }, controller.signal);
            }
            catch (error) {
                if (disposed && controller.signal.aborted)
                    throw new WorktrunkConnectionError({ code: 'CLIENT_DISPOSED', message: 'Worktrunk connection is disposed; reload the plugin and retry.', retryable: false });
                throw new WorktrunkConnectionError({
                    code: 'WORKTRUNK_CONNECTION_FAILED',
                    message: error instanceof Error ? error.message : String(error),
                    details: { endpoint },
                    retryable: true,
                    cause: error,
                });
            }
            const envelope = asEnvelope(raw);
            if (!envelope.ok) {
                const error = envelope.error;
                throw new WorktrunkConnectionError({
                    code: typeof error.code === 'string' ? error.code : 'WORKTRUNK_GATEWAY_FAILED',
                    message: typeof error.message === 'string' ? error.message : '',
                    details: { endpoint, ...(isRecord(error.details) ? error.details : {}) },
                    retryable: true,
                });
            }
            const inner = asEnvelope(envelope.value);
            if (!inner.ok) {
                const error = inner.error;
                throw new WorktrunkConnectionError({
                    code: typeof error.code === 'string' ? error.code : 'WORKTRUNK_DOMAIN_FAILED',
                    message: typeof error.message === 'string' ? error.message : '',
                    details: { endpoint, ...(isRecord(error.details) ? error.details : {}) },
                    retryable: false,
                });
            }
            return inner.value;
        }
        finally {
            inFlight.delete(controller);
        }
    }
    return {
        readPanel: input => invoke(WORKTRUNK_ENDPOINTS.readPanel, input),
        previewHooks: input => invoke(WORKTRUNK_ENDPOINTS.previewHooks, input),
        createWorktree: input => invoke(WORKTRUNK_ENDPOINTS.createWorktree, input),
        async removeWorktree(input) { await invoke(WORKTRUNK_ENDPOINTS.removeWorktree, input); },
        async mergeWorktree(input) { await invoke(WORKTRUNK_ENDPOINTS.mergeWorktree, input); },
        async copyIgnored(input) { await invoke(WORKTRUNK_ENDPOINTS.copyIgnored, input); },
        openWorktree: input => invoke(WORKTRUNK_ENDPOINTS.openWorktree, input),
        ensureWorktreePermission: input => invoke(WORKTRUNK_ENDPOINTS.ensureWorktreePermission, input),
        dispose() {
            if (disposed)
                return;
            disposed = true;
            for (const controller of inFlight)
                controller.abort();
            inFlight.clear();
        },
    };
}
