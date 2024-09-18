/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class KidsOnBroomsActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() 
  {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["kids-on-brooms", "sheet", "actor"],
      width: 800,
      height: 800,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "features" }]
    });
  }

  /** @override */
  get template() 
  {
    console.log("template", this.actor)
    return `systems/kids-on-brooms/templates/actor/actor-${this.actor.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  /** @override */
async getData() 
{
  // Retrieve the data structure from the base sheet.
  const context = super.getData();

  // Use a safe clone of the actor data for further operations.
  const actorData = this.document.toObject(false);

  // Add the actor's data to context.data for easier access, as well as flags.
  context.system = actorData.system;
  context.flags = actorData.flags;

  // Add roll data for TinyMCE editors.
  context.rollData = context.actor.getRollData();
  // Add roll data for TinyMCE editors.
  context.rollData = context.actor.getRollData();


  // Pass the global dice options from CONFIG to the template
  context.availableDice = {
    "d20": "d20",
    "d12": "d12",
    "d10": "d10",
    "d8": "d8",
    "d6": "d6",
    "d4": "d4"
  };

  console.log(context);
  return context;
}

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) 
  {
    super.activateListeners(html);
    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Rollable abilities.
    html.find('.rollable').click(this._onRoll.bind(this));
     
}

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async _onRoll(e) {
    e.preventDefault();
    const element = e.currentTarget;
    const dataset = element.dataset;
  
    // Handle rolls that supply the formula directly
    if (dataset.roll) {
      let label = dataset.label ? `${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.actor.getRollData());
  
      // Send the roll message to chat
      const rollMessage = await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      })
  
      // Now send the follow-up message with the adversity controls
      const adversityControlsMessage = await this._sendAdversityControlsMessage(this.actor.id, rollMessage.id);
  
      return roll;
    }
  }
  
  async _sendAdversityControlsMessage(actorId, rollMessageId) {
    // Create the content for the adversity controls
    const adversityControlsHtml = this._createAdversityControls(actorId, rollMessageId);
  
    // Send the adversity controls as a follow-up message
    const controlMessage = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: adversityControlsHtml,
    });
  
    return controlMessage;
  }
  
  // Create HTML content for adversity controls
  _createAdversityControls(actorId, rollMessageId) {
    return `
      <div class="adversity-controls" data-roll-id="${rollMessageId}">
        <button class="take-adversity" data-actor-id="${actorId}">Take Adversity Token</button>
        <input type="number" class="token-input" value="1" min="1" />
        <button class="spend-adversity" data-actor-id="${actorId}">Spend Adversity Tokens</button>
      </div>
    `;
  }
  

}
