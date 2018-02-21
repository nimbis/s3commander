import * as angular from 'angular';

import 'angular-ui-router';
import routesConfig from './routes';

import {main} from './app/main';

import './index.css';

angular
  .module('s3commander', ['ui.router'])
  .config(routesConfig)
  .component('app', main);
