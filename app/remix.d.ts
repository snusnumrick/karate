// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { EntryContext } from "@remix-run/node";

declare module "@remix-run/node" {
    export interface EntryContext {
        nonce?: string;
    }
}