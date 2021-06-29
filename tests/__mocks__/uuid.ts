/*
 * https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
 * */

export class UuidGenerator {
  private nextId = 1;

  setIsFastStrategy(isFast: boolean) {}

  uuidv4(): string {
    return String(this.nextId++);
  }

  setNextId(i: number) {
    this.nextId = i;
  }
}
