import {Bucket} from './../common/Bucket';
import {IBucketScope} from './IBucketScope';

export class BucketController {
  /**
   * Dependencies we want passed to the constructor.
   * @see http://docs.angularjs.org/guide/di
   */
  public static $inject = [
    '$scope'
  ];

  /**
   * Bucket name. Passed in as a component binding.
   */
  public bucketName: string;

  /**
   * Bucket.
   */
  private bucket: Bucket;

  /**
   * Create a controller instance.
   */
  constructor(private $scope: IBucketScope) { }

  /**
   * Initialize the controller.
   */
  $onInit() {
    this.bucket = this.$scope.bucket = new Bucket(this.bucketName);
  }
}
