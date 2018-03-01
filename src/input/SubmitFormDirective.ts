import * as angular from 'angular';

export class SubmitFormDirective implements ng.IDirective {
  /**
   * TODO.
   */
  public require: string = 'form';

  /**
   * Update the DOM to implement the directive.
   */
  public link(
    scope: ng.IScope,
    element: ng.IAugmentedJQuery,
    attrs: ng.IAttributes,
    form: any
  ) {
    // add a submit method on the form object
    form.submit = function() {
      (element[0] as HTMLFormElement).submit();
    };
  }
}
