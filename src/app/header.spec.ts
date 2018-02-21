import * as angular from 'angular';
import 'angular-mocks';
import {header} from './header';

describe('header component', () => {
  beforeEach(() => {
    angular
      .module('fountainHeader', ['app/header.html'])
      .component('fountainHeader', header);
    angular.mock.module('fountainHeader');
  });

  it('should render \'Fountain Generator\'', angular.mock.inject(($rootScope: ng.IRootScopeService, $compile: ng.ICompileService) => {
    const element = $compile('<fountain-header></fountain-header>')($rootScope);
    $rootScope.$digest();
    const header = element.find('a');
    expect(header.html().trim()).toEqual('Fountain Generator');
  }));
});
