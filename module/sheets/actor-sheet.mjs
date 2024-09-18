/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class KidsOnBroomsActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["kids-on-brooms", "sheet", "actor"],
      width: 800,
      height: 800,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "features" }]
    });
  }

  /** @override */
  get template() {
    console.log("template", this.actor)
    return `systems/kids-on-brooms/templates/actor/actor-${this.actor.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = this.document.toObject(false);

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    return context;
  }
  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Rollable abilities.
    html.find('.rollable').click(this._onRoll.bind(this));
     // Take adversity token
    html.find('.take-token').click(ev => {
      ev.preventDefault();
      this._modifyAdversityTokens(1); // Add 1 adversity token
    });

    // Spend adversity tokens
    html.find('.spend-token').click(ev => {
      ev.preventDefault();
      const element = ev.currentTarget;
      const isOwner = element.dataset.owner === "true";
    
      // Find the number of tokens to spend from the input field
      const tokenInput = element.closest('.adversity-buttons').querySelector('.token-input');
      const tokensToSpend = parseInt(tokenInput.value);

      this._spendAdversityTokens(tokensToSpend, isOwner, element);
    });
}
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(e) {
    e.preventDefault();
    const element = e.currentTarget;
    const dataset = element.dataset;

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      let label = dataset.label ? `[roll] ${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }

  /**
 * Modify the player's adversity tokens by a specified amount.
 * @param {Number} amount - The amount to modify by (positive for gain, negative for spending).
 */
  _modifyAdversityTokens(amount) {
    const currentTokens = this.actor.system.adversityTokens || 0;
    const newTokenCount = Math.max(currentTokens + amount, 0);  // Ensure it doesn't go below 0
  
    // Update the actor's adversity token count
    this.actor.update({ "system.adversityTokens": newTokenCount });
  
    // Optionally, send a chat message informing the user of the token change
    ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `${this.actor.name} ${amount > 0 ? 'gained' : 'spent'} ${Math.abs(amount)} adversity token(s).`
    });
  }
  

  /**
 * Spend adversity tokens and modify the roll result.
 * @param {Number} tokensToSpend - The number of tokens the player wants to spend.
 * @param {Boolean} isOwner - Whether the roll belongs to the current actor (true) or another actor (false).
 * @param {HTMLElement} element - The button element clicked, contains roll info in dataset.
 */
_spendAdversityTokens(tokensToSpend, isOwner, element) {
  const currentTokens = this.actor.system.adversityTokens || 0;
  const tokenCost = isOwner ? tokensToSpend : tokensToSpend * 2;  // 2x cost if not the player's own roll

  // Check if the player has enough tokens
  if (currentTokens < tokenCost) {
    ui.notifications.warn(`You don't have enough adversity tokens! You need ${tokenCost}.`);
    return;
  }

  // Get the roll associated with this button (stored in the element's dataset)
  const rollFormula = element.closest('.rollable').dataset.roll;
  const roll = new Roll(rollFormula, this.actor.getRollData());

  // Modify the roll total by spending tokens (each token increases the roll by 1)
  roll.total += tokensToSpend;

  // Update adversity tokens
  this._modifyAdversityTokens(-tokenCost);

  // Send the modified roll result to chat
  roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    flavor: `${this.actor.name} spent ${tokenCost} adversity token(s) to increase the roll by ${tokensToSpend}. Adjusted Roll Result: ${roll.total}`,
    rollMode: game.settings.get('core', 'rollMode'),
  });
}



}
