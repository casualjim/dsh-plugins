/**
 * dsh-mcp-manager — 客户端 DOM 工具函数。
 *
 * DOM 元素创建、HTTP API 请求等纯工具函数。
 * 仅 export 纯函数，不依赖任何状态。
 */
/** 创建带属性/子节点的 DOM 元素。 */
export declare function el(tag: any, attrs?: any, children?: any): any;
/**
 * HTTP API 请求。
 * 返回 JSON 解析后的 body；非 2xx 抛 Error。
 * 带默认超时（10s，AbortSignal），防挂起请求占用连接（#111 变更点驱动）。
 * 调用方自带 signal 时：超时兜底不启用（调用方 signal 优先，避免双取消竞争）。
 */
export declare function api(path: any, options?: any): Promise<any>;
