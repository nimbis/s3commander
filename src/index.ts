import * as angular from 'angular';

import 'angular-ui-router';
import routesConfig from './routes';

import {main} from './app/main';

import './index.css';

angular
  .module('app', ['ui.router'])
  .config(routesConfig)
  .component('app', main)
