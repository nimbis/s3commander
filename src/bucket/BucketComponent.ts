import {BucketController} from './BucketController';

export const BucketComponent: angular.IComponentOptions = {
  bindings: {
    bucketName: '@name'
  },
  template: require('./bucket.html'),
  controller: BucketController
};
