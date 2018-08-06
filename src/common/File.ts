import {Path} from './Path';
import {IBucketObject} from './IBucketObject';

export class File implements IBucketObject {
  /**
   * Absolute path.
   */
  private path: Path;

  /**
   * Link to download the file.
   */
  private downloadLink: string;

  /**
   * True if the file is deleted.
   */
  private deleted: boolean;

  /**
   * Create a file instance.
   */
  constructor (path: Path, downloadLink: string, deleted: boolean = false) {
    this.path = path;
    this.downloadLink = downloadLink;
    this.deleted = deleted

    if (this.path.isFolder()) {
      throw new Error(`File instance given a folder path: ${path}`);
    }
  }

  /**
   * Get the absolute path.
   */
  public getPath(): Path {
    return this.path;
  }

  /**
   * Get the download link.
   */
  public getDownloadLink(): string {
    return this.downloadLink;
  }
}
