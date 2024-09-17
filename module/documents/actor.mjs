/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class KidsOnBroomsActor extends Actor {

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    const data = { ...this.system}

    return data;
  }


}