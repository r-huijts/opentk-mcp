declare module 'mammoth' {
  interface ConversionOptions {
    buffer?: Buffer;
    path?: string;
    styleMap?: string | string[];
    includeDefaultStyleMap?: boolean;
    includeEmbeddedStyleMap?: boolean;
    convertImage?: (image: any) => Promise<any>;
    ignoreEmptyParagraphs?: boolean;
    idPrefix?: string;
    transformDocument?: (document: any) => any;
  }

  interface ConversionResult {
    value: string;
    messages: Array<{
      type: string;
      message: string;
      error?: Error;
    }>;
  }

  /**
   * Convert a Word document to HTML
   */
  function convertToHtml(options: ConversionOptions): Promise<ConversionResult>;

  /**
   * Extract the raw text from a Word document
   */
  function extractRawText(options: ConversionOptions): Promise<ConversionResult>;

  export { convertToHtml, extractRawText };
}
