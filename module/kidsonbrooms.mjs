// Import document classes.
import { KidsOnBroomsActor } from "./documents/actor.mjs";

// Import sheet classes.
import { KidsOnBroomsActorSheet } from "./sheets/actor-sheet.mjs";

// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { KIDSONBROOMS } from "./helpers/config.mjs";

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', async function() {

  // Add utility classes and functions to the global game object so that they're more easily
  // accessible in global contexts.
  game.kidsonbrooms = {
    KidsOnBroomsActor,
    _onTakeAdversityToken: _onTakeAdversityToken,  // Add the function to the global object
    _onSpendAdversityTokens: _onSpendAdversityTokens  // Add the function to the global object
  };

  // Add custom constants for configuration.
  CONFIG.KIDSONBROOMS = KIDSONBROOMS;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "1d20",
    decimals: 2
  };

  // Define custom Document classes
  CONFIG.Actor.documentClass = KidsOnBroomsActor;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("kids-on-brooms", KidsOnBroomsActorSheet, { makeDefault: true });

  Hooks.on("renderChatMessage", (message, html, data) => {
    const messageElement = html;

    // Check if the message contains adversity controls
    if (messageElement.find(".adversity-controls").length > 0) {
      const actorId = messageElement.find(".take-adversity").data("actor-id");

      // Bind click event listeners to the buttons
      messageElement.find(".take-adversity").click((event) => {
        game.kidsonbrooms._onTakeAdversityToken(event);
      });

      messageElement.find(".spend-adversity").click((event) => {
        // We pass the message id and roll when spending adversity tokens
        game.kidsonbrooms._onSpendAdversityTokens(event, message);
      });
    }
  });

  
  

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

Hooks.once('ready', function() {
  game.socket.on('system.kids-on-brooms', async (data) => {
    if (data.action === "spendTokens") {
      console.log("Received socket request to spend tokens:", data);

      // Only handle the request if the GM is logged in
      if (!game.user.isGM) {
        console.log("Not GM, ignoring the token spend request.");
        return;
      }

      const actor = game.actors.get(data.actorId);

      if (!actor) {
        console.warn("Actor not found:", data.actorId);
        return;
      }

      console.log(`Spending tokens for ${actor.name}, tokens to spend: ${data.tokensToSpend}, token cost: ${data.tokenCost}`);

      const currentTokens = actor.system.adversityTokens || 0;

      // Ensure the actor has enough adversity tokens
      if (currentTokens < data.tokenCost) {
        ui.notifications.warn(`${actor.name} does not have enough adversity tokens.`);
        return;
      }

      // Update the actor's adversity token count
      await actor.update({ "system.adversityTokens": currentTokens - data.tokenCost });

      // Handle the roll update if needed
      const message = game.messages.get(data.rollId);
      const roll = message.rolls[0];

      if (!roll.cumulativeTotal) {
        roll.cumulativeTotal = roll.total;
      }

      roll.cumulativeTotal += data.tokensToSpend;

      const messageElement = $(`.message[data-message-id="${message.id}"]`);
      const diceTotalElement = messageElement.find('.dice-total');
      diceTotalElement.text(roll.cumulativeTotal);

      console.log(`${actor.name} spent ${data.tokensToSpend} tokens, updated roll total to ${roll.cumulativeTotal}`);
    }
  });
});


function _onTakeAdversityToken(e) {
  e.preventDefault();

  // Get the actor who made the roll
  const actorId = e.currentTarget.dataset.actorId;
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

async function _onSpendAdversityTokens(e, message) {
  e.preventDefault();

  const actorId = e.currentTarget.dataset.actorId;
  const actor = game.actors.get(actorId);

  const tokenInput = $(e.currentTarget).closest('.adversity-controls').find('.token-input').val();
  const tokensToSpend = parseInt(tokenInput, 10);

  if (isNaN(tokensToSpend) || tokensToSpend <= 0) {
    ui.notifications.warn("Please enter a valid number of tokens.");
    return;
  }

  let tokenCost = tokensToSpend;

  if (!actor.isOwner) {
    tokenCost = tokensToSpend * 2;
  }

  console.log(`Requesting to spend ${tokensToSpend} tokens for ${actor.name} (cost: ${tokenCost})`);

  // Send socket request to GM
  game.socket.emit('system.kids-on-brooms', {
    action: "spendTokens",
    actorId: actorId,
    tokensToSpend: tokensToSpend,
    tokenCost: tokenCost,
    rollId: message.id  // Send the message id to update the roll result
  });

  ui.notifications.info(`Requested to spend ${tokensToSpend} tokens on ${actor.name}'s roll.`);
}


