declare module 'pdf-parse' {
  /**
   * Parse PDF file
   * @param dataBuffer - PDF file buffer
   * @param options - Custom options
   * @returns Promise with parsed PDF data
   */
  function PDFParse(
    dataBuffer: Buffer,
    options?: {
      pagerender?: (pageData: any) => string;
      max?: number;
      version?: string;
    }
  ): Promise<{
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }>;

  export = PDFParse;
}
