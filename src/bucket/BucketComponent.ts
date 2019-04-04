import {BucketController} from './BucketController';

export const BucketComponent: angular.IComponentOptions = {
  bindings: {
    backendName: '=backend',
    bucketName: '=name',
    allowDownload: '<',
    awsRegion: '=',
    awsAccessKeyId: '=',
    awsSecretAccessKey: '=',
    awsBucketPrefix: '=?'
  },
  template: require('./bucket.html'),
  controller: BucketController
};
