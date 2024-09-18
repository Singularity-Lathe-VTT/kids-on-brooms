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
      let label = dataset.label ? `${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.actor.getRollData());
      
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      }).then(message => {
        // Add adversity controls directly to the chat message content
        const adversityHtml = this._createAdversityControls(this.actor.id);
  
        // Update the chat message content to include the adversity controls
        const newContent = message.content + adversityHtml;
  
        // Update the message with the new content so that everyone can see the buttons
        message.update({ content: newContent });
      });
  
      return roll;
    }
  }
  
  _createAdversityControls(actorId) {
    return `
      <div class="adversity-controls">
        <button class="take-adversity" data-actor-id="${actorId}">Take Adversity Token</button>
        <input type="number" class="token-input" value="1" min="1" />
        <button class="spend-adversity" data-actor-id="${actorId}">Spend Adversity Tokens</button>
      </div>
    `;
  }

  
  
  

  _onTakeAdversityToken(event) {
    event.preventDefault();
  
    // Get the actor who made the roll
    const actorId = event.currentTarget.dataset.actorId;
    const actor = game.actors.get(actorId);
  
    // Ensure the current user is the owner of the actor
    if (!actor.isOwner) {
      ui.notifications.warn("You are not the owner of this character.");
      return;
    }
  
    // Add an adversity token to the actor
    const currentTokens = actor.system.adversityTokens || 0;
    actor.update({ "system.adversityTokens": currentTokens + 1 });
  
    // Notify the user
    ui.notifications.info(`${actor.name} gained 1 adversity token.`);
  }

  async _onSpendAdversityTokens(roll, messageId, event) {
    event.preventDefault();
  
    // Get the actor who made the roll
    const actorId = event.currentTarget.dataset.actorId;
    const actor = game.actors.get(actorId);
  
    // Get the token input value
    const tokenInput = $(event.currentTarget).closest('.adversity-controls').find('.token-input').val();
    const tokensToSpend = parseInt(tokenInput, 10);
  
    if (isNaN(tokensToSpend) || tokensToSpend <= 0) {
      ui.notifications.warn("Please enter a valid number of tokens.");
      return;
    }
  
    let tokenCost = tokensToSpend;
    const currentTokens = actor.system.adversityTokens || 0;
  
    // If the current user is not the owner, they spend double
    if (!actor.isOwner) {
      tokenCost = tokensToSpend * 2;
    }
  
    // Ensure the actor has enough adversity tokens
    if (currentTokens < tokenCost) {
      ui.notifications.warn("You do not have enough adversity tokens.");
      return;
    }
  
    // Update the actor's adversity token count
    await actor.update({ "system.adversityTokens": currentTokens - tokenCost });
  
    // Check if there's already a cumulative total in the roll object
    if (!roll.cumulativeTotal) {
      roll.cumulativeTotal = roll.total;
    }

    // Modify the cumulative total by adding the tokens spent
    roll.cumulativeTotal += tokensToSpend;

    // Find the message element by its ID
    const messageElement = $(`.message[data-message-id="${messageId}"]`);

    // Find the element containing the dice total and update it
    const diceTotalElement = messageElement.find('.dice-total');
    diceTotalElement.text(roll.cumulativeTotal);

    // Notify the user
    ui.notifications.info(`${actor.name} spent ${tokensToSpend} tokens to increase the roll total.`);
  }
  

}
