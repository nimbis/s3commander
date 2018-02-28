import {Path} from './Path';
import {StorageBucket} from './StorageBucket';
import {StorageObject} from './StorageObject';

export interface IBackend {
  /**
   * Get a bucket with the given name.
   */
  getBucket(name: string): Promise<StorageBucket>;

  /**
   * Get bucket objects with a given prefix.
   */
  getObjects(bucket: StorageBucket, prefix: Path): Promise<StorageObject[]>;

  /**
   * Delete multiple objects from the bucket.
   */
  deleteObjects(bucket: StorageBucket, prefix: Path): Promise<any>;
}
