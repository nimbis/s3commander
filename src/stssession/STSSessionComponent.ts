import {STSSessionController} from './STSSessionController';

export const STSSessionComponent: angular.IComponentOptions = {
  bindings: {
    backendName: '=backend',
    bucketName: '=name',
    allowDownload: '<',
    awsRegion: '=',
    awsBucketPrefix: '=?',
    stsApiUrl: '=',
    stsHeaderName: '=?',
    stsHeaderValue: '=?'
  },
  template: require('./stssession.html'),
  controller: STSSessionController
};
