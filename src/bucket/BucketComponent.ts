import {BucketController} from './BucketController';

export const BucketComponent: angular.IComponentOptions = {
  bindings: {
    backendName: '@backend',
    bucketName: '@name',
    bucketRegion: '@region'
  },
  template: require('./bucket.html'),
  controller: BucketController
};
