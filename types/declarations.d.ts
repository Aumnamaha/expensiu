// Global type declarations for react-native-encrypted-storage
declare module 'react-native-encrypted-storage' {
  export function setItemAsync(key: string, value: string | number): Promise<void>;
  export function getItemAsync(key: string): Promise<string | null>;
  export function removeItemAsync(key: string): Promise<void>;
}

// Global type declarations for expo-local-authentication
declare module 'expo-local-authentication' {
  export interface AuthenticationCredential {
    error?: any;
    success: boolean;
  }

  export function isDeviceEnrolledAsync(type: 'fingerprint' | 'face'): Promise<{ supportedType: boolean }>;
  export function isDeviceEnrolledSync(type: 'fingerprint' | 'face'): boolean;
  export function requestAuthenticationAsync(
    credentialRequestConfiguration?: any
  ): Promise<AuthenticationCredential>;
}

// Global type declarations for expo-document-picker
declare module 'expo-document-picker' {
  interface PickDocumentOptions {
    label?: string;
    type?: ('*/*' | `.${string}`)[];
    copyToCacheDirectory?: boolean;
  }

  export interface DocumentPickerResult {
    assets: Array<{ uri: string; name: string; size: number }>;
    canceled?: boolean;
    type: 'multi' | 'single';
  }

  export function getDocumentAsync(options?: PickDocumentOptions): Promise<DocumentPickerResult>;
}

// Global type declarations for react-native-mlc-llm
declare module 'react-native-mlc-llm' {
  export const download: () => Promise<void>;
  export const getMLCFolder: () => string;
  export function send(
    prompt: string,
    options?: { model_path: string; max_tokens?: number; temperature?: number }
  ): Promise<any>;
}

// Global type declarations for react-native-pdf-lib
declare module 'react-native-pdf-lib' {
  interface PdfData {
    pages: Array<{ content: string }>;
    metadata: any;
  }

  export function readPdf(uri: string): Promise<PdfData>;
  export function extractText(pages: any[]): string;
}

// Global type declarations for xlsx
declare module 'xlsx' {
  interface Row {
    [key: string]: any;
  }

  interface Workbook<T = SheetType> {
    SheetNames: (string | number)[];
    Sheets: { [K in string | number]?: SheetData<T>; };
    addSheet?: (name: string, data?: any[]) => void;
    sheet_name?: (sheetIndex: number | string) => string;
    sheets?: (range: 'all' | string) => (string | number)[];
  }

  export function writeFile<T extends SheetType>(
    wb: Workbook<T>,
    options?: WritableOptions
  ): string | Buffer | Blob;

  export function readFile<T extends SheetType>(
    filename: string,
    opt?: ReadableOptions & Partial<ParseableOptions>
  ): Workbook<T>;

  export namespace Utils {
    export function json_to_sheet<T = Row>(json: Array<T>): SheetData<T>;
    export function sheet_to_json<T = any>(ws: WSSheetType): T[];
  }

  export interface WritableOptions {
    type?: 'array' | 'string' | 'base64';
    bookType?: string;
    buffer?: boolean;
    typeval?: boolean;
  }

  interface ReadableOptions {
    type?: string;
    cellDates?: string;
    cellNF?: string;
    raw?: boolean;
    dateNF?: string;
  }

  export interface ParseableOptions extends ReadableOptions {
    defval?: any;
  }

  export interface SheetType {}
  export type WSSheetType = Record<string, any>;
  export type SheetData<T = Row> = T[];

  // Simplified types for common operations
  export function write(file: string, wb: Workbook): void;
  export function read(data: string): Workbook;
}
