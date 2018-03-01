import {Path} from './Path';
import {Bucket} from './Bucket';
import {File} from './File';
import {IFileVersion} from './IFileVersion';
import {Folder} from './Folder';
import {IFolderContents} from './IFolderContents';

export interface IBackend {
  /**
   * Get a bucket with the given name.
   */
  getBucket(name: string): Promise<Bucket>;

  /**
   * Get the contents of a folder.
   */
  getContents(bucket: Bucket, folder: Folder): Promise<IFolderContents>;

  /**
   * Create a folder.
   */
  createFolder(bucket: Bucket, folder: Folder): Promise<any>;

  /**
   * Delete a folder and its contents.
   */
  deleteFolder(bucket: Bucket, folder: Folder): Promise<any>;

  /**
   * Get a download link for a file.
   */
  getFileLink(bucket: Bucket, file: File): string;

  /**
   * Get versions of the given file.
   */
  getFileVersions(bucket: Bucket, file: File): Promise<IFileVersion[]>;

  /**
   * Delete a file.
   */
  deleteFile(bucket: Bucket, file: File): Promise<any>;
}
