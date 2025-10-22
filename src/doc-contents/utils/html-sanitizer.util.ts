import { BadRequestException } from '@nestjs/common';

export class HtmlSanitizer {
  private static readonly DANGEROUS_PATTERNS = [
    /fetch\s*\(/gi,
    /XMLHttpRequest/gi,
    /localStorage/gi,
    /sessionStorage/gi,
    /document\.cookie/gi,
    /eval\s*\(/gi,
    /window\.location/gi,
    /window\.open/gi,
  ];

  /**
   * Validates HTML content for dangerous JavaScript patterns
   * @param htmlContent HTML file content as string
   * @throws BadRequestException if dangerous patterns are found
   */
  static validate(htmlContent: string): void {
    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(htmlContent)) {
        throw new BadRequestException(
          `HTML contains forbidden JavaScript pattern: ${pattern.source}`,
        );
      }
    }

    // Check for external script sources
    const externalScriptRegex = /<script[^>]+src=["']https?:\/\//gi;
    if (externalScriptRegex.test(htmlContent)) {
      throw new BadRequestException(
        'HTML contains external script references (only local scripts allowed)',
      );
    }
  }

  /**
   * Validates file content if it's an HTML file
   * @param content File content as buffer
   * @param fileName File name to check extension
   */
  static validateFile(content: Buffer, fileName: string): void {
    // Only validate HTML files
    if (!fileName.toLowerCase().endsWith('.html')) {
      return;
    }

    // Convert buffer to string and validate
    const htmlContent = content.toString('utf8');
    this.validate(htmlContent);
  }
}

