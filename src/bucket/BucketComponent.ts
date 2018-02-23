import {BucketController} from './BucketController';

export const BucketComponent: angular.IComponentOptions = {
  bindings: {
    backendName: '@backend',
    bucketName: '@name',
    awsRegion: '@awsRegion',
    awsAccessKeyId: '@awsAccessKeyId',
    awsSecretAccessKey: '@awsSecretAccessKey'
  },
  template: require('./bucket.html'),
  controller: BucketController
};
