import {BucketController} from './BucketController';

export const BucketComponent: angular.IComponentOptions = {
  bindings: {
    backendName: '=backend',
    bucketName: '=name',
    allowDownload: '<',
    awsRegion: '=',
    awsAccessKeyId: '=',
    awsSecretAccessKey: '=',
    awsSessionToken: '=?',
    awsBucketPrefix: '=?',
    stsApiUrl: '=?',
    stsHeaderName: '=?',
    stsHeaderValue: '=?'
  },
  template: require('./bucket.html'),
  controller: BucketController
};
