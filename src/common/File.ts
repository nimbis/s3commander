import {Path} from './Path';
import {IBucketObject} from './IBucketObject';

export class File implements IBucketObject {
  /**
   * Absolute path.
   */
  private path: Path;

  /**
   * Create a file instance.
   */
  constructor (path: Path) {
    this.path = path;
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
}
