import { BadRequestException } from '@nestjs/common';
import AdmZip = require('adm-zip');

export class ZipValidator {
  private static readonly MAX_FILES = 100;
  private static readonly ALLOWED_EXTENSIONS = [
    '.html',
    '.css',
    '.js',
    '.json',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.svg',
    '.mp4',
    '.webm',
    '.mp3',
    '.wav',
  ];
  private static readonly FORBIDDEN_EXTENSIONS = [
    '.exe',
    '.bat',
    '.sh',
    '.php',
    '.py',
    '.rb',
    '.jar',
  ];

  /**
   * Validates a ZIP file buffer
   * @param buffer ZIP file buffer
   * @throws BadRequestException if validation fails
   */
  static validate(buffer: Buffer): void {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    // Check for index.html at root level
    const hasIndexHtml = entries.some(
      (e) => !e.isDirectory && e.entryName === 'index.html',
    );

    if (!hasIndexHtml) {
      throw new BadRequestException(
        'ZIP must contain index.html at root level',
      );
    }

    // Check file count
    const fileCount = entries.filter((e) => !e.isDirectory).length;
    if (fileCount > this.MAX_FILES) {
      throw new BadRequestException(
        `ZIP contains too many files (max ${this.MAX_FILES})`,
      );
    }

    // Validate each file
    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const fileName = entry.entryName.toLowerCase();

      // Check for forbidden extensions
      const hasForbiddenExt = this.FORBIDDEN_EXTENSIONS.some((ext) =>
        fileName.endsWith(ext),
      );
      if (hasForbiddenExt) {
        throw new BadRequestException(
          `Forbidden file type detected: ${entry.entryName}`,
        );
      }

      // Check for allowed extensions
      const hasAllowedExt = this.ALLOWED_EXTENSIONS.some((ext) =>
        fileName.endsWith(ext),
      );
      if (!hasAllowedExt) {
        throw new BadRequestException(
          `Unsupported file type: ${entry.entryName}`,
        );
      }

      // Security: check for path traversal attempts
      if (fileName.includes('..') || fileName.startsWith('/')) {
        throw new BadRequestException(`Invalid file path: ${entry.entryName}`);
      }
    }
  }

  /**
   * Extracts all file entries from ZIP (excluding directories)
   * @param buffer ZIP file buffer
   * @returns Array of ZIP entries
   */
    static getFileEntries(buffer: Buffer): any[] {
    const zip = new AdmZip(buffer);
    return zip.getEntries().filter((e) => !e.isDirectory);
  }
}

