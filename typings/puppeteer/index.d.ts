declare module 'puppeteer' {
  export class ElementHandle<T extends Element = Element> {
    click(options?: { clickCount?: number }): Promise<void>;
    type(text: string, options?: { delay?: number }): Promise<void>;
  }

  export interface Page {
    $<T extends Element = Element>(selector: string): Promise<ElementHandle<T> | null>;
    $$<T extends Element = Element>(selector: string): Promise<ElementHandle<T>[]>;
    $eval<T>(
      selector: string,
      pageFunction: (element: Element) => T
    ): Promise<T>;
    $$eval<T>(
      selector: string,
      pageFunction: (elements: Element[]) => T
    ): Promise<T>;
    goto(
      url: string,
      options?: { waitUntil?: 'networkidle0' | 'networkidle2' | 'domcontentloaded' }
    ): Promise<unknown>;
    waitForNavigation(
      options?: { waitUntil?: 'networkidle0' | 'networkidle2' | 'domcontentloaded' }
    ): Promise<unknown>;
    waitForFunction(
      pageFunction: () => boolean,
      options?: { polling?: number; timeout?: number }
    ): Promise<unknown>;
    waitForSelector(selector: string, options?: { timeout?: number }): Promise<unknown>;
    setViewport(viewport: { width: number; height: number; deviceScaleFactor?: number }): Promise<void>;
    setBypassCSP(bypass: boolean): Promise<void>;
    setRequestInterception(value: boolean): Promise<void>;
    evaluateOnNewDocument(pageFunction: () => void): Promise<void>;
    select(selector: string, value: string): Promise<string[]>;
    click(selector: string): Promise<void>;
    close(): Promise<void>;
    url(): string;
    on(eventName: string, handler: (...args: unknown[]) => void): Page;
    on(eventName: 'pageerror', handler: (error: Error) => void): Page;
    on(eventName: 'console', handler: (msg: unknown) => void): Page;
    on(eventName: 'request', handler: (request: HTTPRequest) => void | Promise<void>): Page;
  }

  export interface HTTPRequest {
    url(): string;
    method(): string;
    respond(response: { status: number; contentType: string; body: string }): Promise<void>;
    continue(): Promise<void>;
  }

  export interface Browser {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }

  export type Awaitable<T> = T | Promise<T>;

  export function launch(options: unknown): Promise<Browser>;
}
