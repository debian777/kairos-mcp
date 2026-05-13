/**
 * archiver@8 ships ESM named `ZipArchive`; `@types/archiver` still models the v7 callable default export.
 * Surface only what `src/tools/skill-export/zip-bundle.ts` uses.
 */
declare module "archiver" {
  import type { Readable, Writable } from "node:stream";
  import type { ZlibOptions } from "node:zlib";
  import { Transform } from "node:stream";

  export interface ZipArchiveOptions {
    zlib?: ZlibOptions | undefined;
    comment?: string | undefined;
    forceLocalTime?: boolean | undefined;
    forceZip64?: boolean | undefined;
    namePrependSlash?: boolean | undefined;
    store?: boolean | undefined;
  }

  export class ZipArchive extends Transform {
    constructor(options?: ZipArchiveOptions | undefined);
    append(source: Readable | Buffer | string, data: { name: string }): this;
    pipe<T extends Writable>(destination: T): T;
    finalize(): Promise<void>;
  }
}
