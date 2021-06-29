/*
 * https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
 * */

export class UuidGenerator {
  static genId = 0;
  private instance: number;
  constructor() {
    this.instance = UuidGenerator.genId++;
    console.log(this.instance, "call generator constructor");
  }
  private nextId = 1;

  setIsFastStrategy(isFast: boolean) {}

  uuidv4(arg): string {
    console.log(this.instance, arg);
    return String(this.nextId++);
  }

  setNextId(i: number) {
    this.nextId = i;
  }
}
