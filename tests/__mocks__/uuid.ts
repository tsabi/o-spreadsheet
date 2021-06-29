/*
 * https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
 * */

export class UuidGenerator {
  static genId = 0;
  // private instance: number;
  constructor() {
    // this.instance = UuidGenerator.genId++;
    // const worker_id = process.env.JEST_WORKER_ID;
    // console.log(this.instance, "call generator constructor  worker ", worker_id);
  }
  private nextId = 1;

  setIsFastStrategy(isFast: boolean) {}

  uuidv4(arg=undefined): string {
    // const worker_id = process.env.JEST_WORKER_ID;
    // console.trace("Calling uuidv4 instance", this.instance, " worker ", worker_id);

    return String(this.nextId++);
  }

  setNextId(i: number) {
    this.nextId = i;
  }
}

export function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
    v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}