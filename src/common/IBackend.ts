import {Path} from './Path';
import {Bucket} from './Bucket';
import {StorageObject} from './StorageObject';

export interface IBackend {
  /**
   * Get a bucket with the given name.
   */
  getBucket(name: string): Promise<Bucket>;

  /**
   * Get bucket objects with a given prefix.
   */
  getObjects(bucket: Bucket, prefix: Path): Promise<StorageObject[]>;
}
