import {Path} from './Path';

export interface IBucketObject {
  /**
   * Get the object's absolute path relative to the bucket root.
   */
  getPath(): Path;
}
