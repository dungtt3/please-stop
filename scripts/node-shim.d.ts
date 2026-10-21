// Minimal Node typings for scripts (avoids adding @types/node as a dependency).
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}
declare const process: { argv: string[]; exit(code?: number): never };
