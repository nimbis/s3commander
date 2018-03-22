import * as angular from 'angular';

export class FileInputDirective implements ng.IDirective {
  /**
   * TODO.
   */
  public require: string = 'ngModel';

  /**
   * TODO.
   */
  public scope = {
    ngChange: '&'
  };

  /**
   * Called when the model value is changed. Passed in through the scope.
   */
  public ngChange() {
    // overriden by scope binding
  }

  /**
   * Update the DOM to implement the directive.
   */
  public link(
    scope: ng.IScope,
    element: ng.IAugmentedJQuery,
    attrs: ng.IAttributes,
    ngModel: any
  ) {
    // create the lements
    let input = angular.element('<input type="file" name="file" />');
    let button = angular.element('<button type="button" class="s3c-button">Upload File</button>');

    // update the model when the user selects one or more files
    input.on('change', () => {
      let inputField = (input[0] as any);
      if (inputField.files.length > 0) {
        ngModel.$setViewValue(inputField.files[0]);
      } else {
        ngModel.$setViewValue(null);
      }

      this.ngChange();
    });

    // trigger the file input dialog when the user presses the button
    button.on('click', () => {
      (input[0] as any).click();
    });

    // add the elements to the DOM
    element.append(input);
    element.append(button);
  }
}
