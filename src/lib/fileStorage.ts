/**
 * File Storage Abstraction
 * 
 * Provides unified interface for file storage with environment-based implementation:
 * - Development: Local filesystem (./storage/)
 * - Production: AWS S3
 * 
 * Used for:
 * - BIR receipt PDFs (Epic 5)
 * - Expense attachment images (Epic 7)
 * - Product images from Shopee (Epic 4)
 */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";

// File metadata for tracking uploaded files
export interface FileMetadata {
  fileName: string;
  mimeType: string;
  size: number;
  uploadedBy?: string; // User ID who uploaded the file
  shopId?: string; // Shop ID for multi-tenant isolation
  category: "receipt" | "expense-attachment" | "product-image";
}

// Unified file storage interface
export interface FileStorage {
  /**
   * Upload a file to storage
   * @param file - File content as Buffer
   * @param metadata - File metadata (name, type, size, category, etc.)
   * @returns File key/path that can be used to retrieve the file
   */
  upload(file: Buffer, metadata: FileMetadata): Promise<string>;

  /**
   * Download a file from storage
   * @param key - File key returned from upload()
   * @returns File content as Buffer
   */
  download(key: string): Promise<Buffer>;

  /**
   * Generate a signed URL for temporary file access
   * @param key - File key
   * @param expiresIn - URL expiration time in seconds
   * @returns Signed URL that expires after specified time
   */
  getSignedUrl(key: string, expiresIn: number): Promise<string>;

  /**
   * Delete a file from storage
   * @param key - File key
   */
  delete(key: string): Promise<void>;
}

/**
 * Local filesystem implementation for development
 */
export class LocalFileStorage implements FileStorage {
  private storageDir: string;

  constructor(storageDir = "./storage") {
    this.storageDir = path.resolve(storageDir);
    void this.ensureStorageDir();
  }

  /**
   * Ensure storage directory exists, create if not
   */
  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.access(this.storageDir);
    } catch {
      await fs.mkdir(this.storageDir, { recursive: true });
      console.log(`✅ Created storage directory: ${this.storageDir}`);
    }
  }

  async upload(file: Buffer, metadata: FileMetadata): Promise<string> {
    await this.ensureStorageDir();

    // Generate unique file key
    const key = `${Date.now()}-${randomUUID()}-${metadata.fileName}`;
    const filePath = path.join(this.storageDir, key);

    await fs.writeFile(filePath, file);
    console.log(`✅ Uploaded file to local storage: ${key}`);

    return key;
  }

  async download(key: string): Promise<Buffer> {
    const filePath = path.join(this.storageDir, key);

    try {
      return await fs.readFile(filePath);
    } catch (error) {
      throw new Error(`File not found: ${key}`);
    }
  }

  async getSignedUrl(key: string, expiresIn: number): Promise<string> {
    const filePath = path.join(this.storageDir, key);

    // Verify file exists
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`File not found: ${key}`);
    }

    // For local storage, return file:// URL
    // Note: This is not publicly accessible, just for local testing
    console.warn(
      `⚠️  LocalFileStorage: getSignedUrl returns file:// URL (not publicly accessible)`
    );
    return `file://${filePath}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.storageDir, key);

    try {
      await fs.unlink(filePath);
      console.log(`✅ Deleted file from local storage: ${key}`);
    } catch {
      // Idempotent: don't throw error if file doesn't exist
    }
  }
}

/**
 * AWS S3 implementation for production
 */
export class S3FileStorage implements FileStorage {
  private s3Client: S3Client;
  private bucket: string;

  constructor(
    bucket: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string
  ) {
    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "S3FileStorage requires: bucket, region, accessKeyId, secretAccessKey"
      );
    }

    this.bucket = bucket;
    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    console.log(`✅ S3FileStorage initialized (bucket: ${bucket}, region: ${region})`);
  }

  async upload(file: Buffer, metadata: FileMetadata): Promise<string> {
    // Generate S3 key with category prefix
    const key = `${metadata.category}/${Date.now()}-${randomUUID()}-${metadata.fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: metadata.mimeType,
      Metadata: {
        fileName: metadata.fileName,
        size: metadata.size.toString(),
        ...(metadata.shopId && { shopId: metadata.shopId }),
        ...(metadata.uploadedBy && { uploadedBy: metadata.uploadedBy }),
      },
    });

    await this.s3Client.send(command);
    console.log(`✅ Uploaded file to S3: ${key}`);

    return key;
  }

  async download(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      const response = await this.s3Client.send(command);

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      if (response.Body) {
        for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }
      }

      return Buffer.concat(chunks);
    } catch (error) {
      throw new Error(`Failed to download file from S3: ${key}`);
    }
  }

  async getSignedUrl(key: string, expiresIn: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn,
    });

    console.log(`✅ Generated S3 signed URL (expires in ${expiresIn}s)`);

    return signedUrl;
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
      console.log(`✅ Deleted file from S3: ${key}`);
    } catch {
      // Idempotent: don't throw error if file doesn't exist
    }
  }
}

/**
 * Create file storage implementation based on environment
 */
function createFileStorage(): FileStorage {
  // Production: Use S3 if credentials are available
  if (
    env.AWS_S3_BUCKET &&
    env.AWS_REGION &&
    env.AWS_ACCESS_KEY_ID &&
    env.AWS_SECRET_ACCESS_KEY
  ) {
    console.log("✅ Using S3 file storage (production)");
    return new S3FileStorage(
      env.AWS_S3_BUCKET,
      env.AWS_REGION,
      env.AWS_ACCESS_KEY_ID,
      env.AWS_SECRET_ACCESS_KEY
    );
  }

  // Development: Use local filesystem
  if (env.NODE_ENV === "development") {
    console.log("✅ Using local file storage (development)");
    return new LocalFileStorage("./storage");
  }

  // Production without S3 credentials - throw error
  if (env.NODE_ENV === "production") {
    throw new Error(
      "AWS S3 credentials required in production. Set AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
    );
  }

  // Fallback to local storage for other environments
  console.warn("⚠️  Using local file storage (no S3 credentials)");
  return new LocalFileStorage("./storage");
}

// Export singleton file storage instance
export const fileStorage = createFileStorage();
