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
   * Create a file instance.
   */
  constructor (path: Path, downloadLink: string) {
    this.path = path;
    this.downloadLink = downloadLink;

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
