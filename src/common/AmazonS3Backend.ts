import {Bucket} from './Bucket';
import {IBackend} from './IBackend';

export class AmazonS3Backend extends IBackend {
  /**
   * Create an instance of the backend.
   */
  constructor(public region: string) { }

  /**
   * Get a bucket with the given name.
   */
  getBucket(name: string): Bucket {
    return new Bucket(name);
  }
}
