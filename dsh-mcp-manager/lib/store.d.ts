/**
 * dsh-mcp-manager — 配置存储（独立模块，无内部依赖）。
 *
 * 服务器配置持久化在 `~/.dsh/dsh-mcp.json`（版本化，原子写入）。
 * 由 lib/index.js 组合根 re-export。
 */
import type { ServerConfig } from "./types.js";
/** 默认配置存储路径。 */
export declare function defaultStorePath(): string;
/**
 * 版本化存储：{ version: 1, servers: ServerConfig[] }。
 * 记录磁盘 mtime 基线：外部修改（git pull / 手动编辑）可被 reloadIfChanged 检测，
 * 无需重启宿主即生效（写路径全部经 save 落盘，内存态始终有盘上副本，重读无冲突）。
 */
export declare class McpStore {
    path: string;
    data: {
        version: number;
        servers: ServerConfig[];
    };
    /** 上次读/写时的文件 mtime；undefined = 从未建立基线，0 = 当前文件不存在。 */
    mtimeMs: number | undefined;
    constructor(path: string);
    load(): Promise<void>;
    save(): Promise<void>;
    /** 磁盘文件是否已被外部修改（mtime 与基线比对；无基线不视为变更）。 */
    changedOnDisk(): Promise<boolean>;
    /** 外部变更时重读；返回是否发生了重读。 */
    reloadIfChanged(): Promise<boolean>;
    find(name: string): ServerConfig | undefined;
    upsert(server: ServerConfig): void;
    remove(name: string): void;
}
