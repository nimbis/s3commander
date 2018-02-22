import * as angular from 'angular';

import {BucketComponent} from './bucket/BucketComponent';

import './index.css';

angular
  .module('s3commander', [])
  .component('bucket', BucketComponent);
