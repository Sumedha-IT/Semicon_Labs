import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileStorageService {
  private readonly baseStoragePath = './temp-uploads/lessons';
  private readonly baseUrl = 'http://localhost:3000/temp-uploads/lessons';

  constructor() {
    // Ensure base storage directory exists
    if (!fs.existsSync(this.baseStoragePath)) {
      fs.mkdirSync(this.baseStoragePath, { recursive: true });
    }
  }

  /**
   * Uploads a file to local storage
   * @param key File path (e.g., "123/index.html")
   * @param content File content as buffer
   * @returns Full URL to the file
   */
  async uploadFile(key: string, content: Buffer): Promise<string> {
    const fullPath = path.join(this.baseStoragePath, key);
    const directory = path.dirname(fullPath);

    // Ensure directory exists
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // Write file
    fs.writeFileSync(fullPath, content);

    // Return URL
    return `${this.baseUrl}/${key.replace(/\\/g, '/')}`;
  }

  /**
   * Deletes a folder and all its contents
   * @param keyPrefix Folder path prefix (e.g., "123/")
   */
  async deleteFolder(keyPrefix: string): Promise<void> {
    const fullPath = path.join(this.baseStoragePath, keyPrefix);

    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }

  /**
   * Gets the storage URL for a file
   * @param key File path
   * @returns Full URL to the file
   */
  getFileUrl(key: string): string {
    return `${this.baseUrl}/${key.replace(/\\/g, '/')}`;
  }

  /**
   * Gets the storage folder URL for a doc content
   * @param docContentId Doc content ID
   * @returns Full URL to the folder
   */
  getStorageFolder(docContentId: number): string {
    return `${this.baseUrl}/${docContentId}/`;
  }

  /**
   * Gets the storage key prefix for a doc content
   * @param docContentId Doc content ID
   * @returns Storage key prefix (e.g., "123/")
   */
  getStorageKeyPrefix(docContentId: number): string {
    return `${docContentId}/`;
  }

  /**
   * Gets the URL to index.html for viewing
   * @param docContentId Doc content ID
   * @returns Full URL to index.html
   */
  getIndexFileUrl(docContentId: number): string {
    return `${this.baseUrl}/${docContentId}/index.html`;
  }
}

