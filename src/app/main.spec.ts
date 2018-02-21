import * as angular from 'angular';
import 'angular-mocks';
import {main} from './main';

describe('main component', () => {
  beforeEach(() => {
    angular
      .module('s3commander', ['app/main.html'])
      .component('app', main);
    angular.mock.module('s3commander');
  });
});
