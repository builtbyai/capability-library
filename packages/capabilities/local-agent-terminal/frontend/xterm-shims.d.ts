/**
 * Ambient module shims for xterm.
 *
 * xterm (`@xterm/xterm` + addons) is a PEER dependency: the host dashboard
 * installs it and provides the real, richer types. This file exists so the
 * capability typechecks standalone (`tsc -b`) in a workspace where the peer is
 * not installed. It declares only the surface this capability actually uses.
 *
 * If you install `@xterm/xterm` into this workspace, delete this file — the
 * real package types supersede it.
 */
declare module '@xterm/xterm' {
  export interface ITerminalOptions {
    [key: string]: unknown;
  }
  export interface IBufferLine {
    translateToString(trimRight?: boolean): string;
  }
  export interface IBuffer {
    readonly baseY: number;
    readonly cursorY: number;
    getLine(y: number): IBufferLine | undefined;
  }
  export interface IBufferNamespace {
    readonly active: IBuffer;
  }
  export class Terminal {
    constructor(options?: ITerminalOptions);
    readonly cols: number;
    readonly rows: number;
    readonly buffer: IBufferNamespace;
    loadAddon(addon: unknown): void;
    open(parent: HTMLElement): void;
    onData(handler: (data: string) => void): void;
    write(data: string): void;
    resize(cols: number, rows: number): void;
    dispose(): void;
  }
}

declare module '@xterm/addon-fit' {
  export class FitAddon {
    fit(): void;
  }
}

declare module '@xterm/addon-web-links' {
  export class WebLinksAddon {
    constructor(handler?: (event: MouseEvent, uri: string) => void);
  }
}
