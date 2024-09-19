/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class KidsOnBroomsActor extends Actor {

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    let data = { ...this.system };
  
    // Wand bonuses
    data.wandBonus = {
      wood: this._getWandBonus(this.system.wand.wood),
      core: this._getWandBonus(this.system.wand.core)
    };
  
    return data;
  }
  
  _getWandBonus(type) {
    const bonuses = {
      "Wisteria": { stat: "brains", bonus: 1 },
      "Hawthorn": { stat: "brains", bonus: 1 },
      "Pine": { stat: "brawn", bonus: 1 },
      "Oak": { stat: "brawn", bonus: 1 },
      "Crabapple": { stat: "fight", bonus: 1 },
      "Dogwood": { stat: "fight", bonus: 1 },
      "Birch": { stat: "flight", bonus: 1 },
      "Bamboo": { stat: "flight", bonus: 1 },
      "Ironwood": { stat: "grit", bonus: 1 },
      "Maple": { stat: "grit", bonus: 1 },
      "Lilac": { stat: "charm", bonus: 1 },
      "Cherry": { stat: "charm", bonus: 1 },
      "Parchment": { stat: "brains", bonus: 1 },
      "Phoenix Feather": { stat: "brains", bonus: 1 },
      "Owl Feather": { stat: "brains", bonus: 1 },
      "Gorilla Fur": { stat: "brawn", bonus: 1 },
      "Ogre’s Fingernail": { stat: "brawn", bonus: 1 },
      "Hippo’s Tooth": { stat: "brawn", bonus: 1 },
      "Dragon’s Heartstring": { stat: "fight", bonus: 1 },
      "Wolf’s Tooth": { stat: "fight", bonus: 1 },
      "Elk’s Antler": { stat: "fight", bonus: 1 },
      "Hawk’s Feather": { stat: "flight", bonus: 1 },
      "Bat’s Bone": { stat: "flight", bonus: 1 },
      "Changeling’s Hair": { stat: "charm", bonus: 1 },
      "Gold": { stat: "charm", bonus: 1 },
      "Mirror": { stat: "charm", bonus: 1 },
      "Steel": { stat: "grit", bonus: 1 },
      "Diamond": { stat: "grit", bonus: 1 },
      "Lion’s Mane": { stat: "grit", bonus: 1 }
    };
  
    return bonuses[type] || { stat: "", bonus: 0 };
  }


}