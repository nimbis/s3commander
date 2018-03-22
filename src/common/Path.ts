export class Path {
  /**
   * Components between separators.
   */
  private parts: string[];

  /**
   * Whether the path represents a folder.
   */
  private folder: boolean;

  /**
   * Create a new path.
   */
  constructor (path: string = '') {
    // split the path into components
    this.parts = path.split('/').filter(function(part: string) {
      return part.length > 0;
    });

    // detect if this path refers to a folder
    this.folder = (path.substring(path.length - 1) === '/');
  }

  /**
   * Create a deep copy of this path.
   */
  public clone(): Path {
    let newPath = new Path();
    newPath.parts = this.parts.slice(0);
    newPath.folder = this.folder;

    return newPath;
  }

  /**
   * Check if this path is equal to the given path.
   */
  public equals(other: Path): boolean {
    return (this.toString() === other.toString());
  }

  /**
   * Get path components.
   */
  public components(): string[] {
    return this.parts;
  }

  /**
   * Get the file or folder name.
   */
  public name(): string {
    // corner case: root path
    if (this.parts.length === 0) {
      return '';
    }

    // last component name
    return this.parts[this.parts.length - 1];
  }

  /**
   * Push one or more components to the path.
   */
  public push(subpath: string): Path {
    // split the subpath into components
    let subparts = subpath.split('/').filter(function(part: string) {
      return part.length > 0;
    });

    // update the existing components and folder flag
    this.parts = this.parts.concat(subparts);
    this.folder = (subpath.substring(subpath.length - 1) === '/');

    // return the path so we can chain function calls
    return this;
  }

  /**
   * Pop a component from the path.
   */
  public pop(): Path {
    // remove a trailing component if available
    if (this.parts.length > 0) {
      this.parts.pop();
    }

    // return the path so we can chain function calls
    return this;
  }

  /**
   * Check if this path refers to a folder.
   */
  public isFolder(): boolean {
    return this.folder;
  }

  /**
   * Get the string representation.
   */
  public toString(): string {
    // corner case: empty path
    if (this.parts.length === 0) {
      return '';
    }

    // determine the path string
    var uri = this.parts.join('/');
    if (this.folder) {
      return `${uri}/`;
    }

    return uri;
  }
}
