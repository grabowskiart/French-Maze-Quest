declare module "cookie" {
  export interface SerializeOptions {
    httpOnly?: boolean;
    sameSite?: boolean | "lax" | "strict" | "none";
    secure?: boolean;
    path?: string;
    domain?: string;
    maxAge?: number;
    expires?: Date;
    encode?: (value: string) => string;
  }
  export function parse(str: string): Record<string, string | undefined>;
  export function serialize(name: string, value: string, options?: SerializeOptions): string;
}

declare module "cookie-signature" {
  export function sign(value: string, secret: string): string;
  export function unsign(input: string, secret: string): string | false;
}
