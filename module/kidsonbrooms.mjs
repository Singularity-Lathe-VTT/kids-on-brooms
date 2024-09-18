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
  // Add utility classes and functions to the global game object so that they're more easily
  // accessible in global contexts.
  game.kidsonbrooms = {
    KidsOnBroomsActor,
    _onTakeAdversityToken: _onTakeAdversityToken,  // Add the function to the global object
    _onSpendAdversityTokens: _onSpendAdversityTokens  // Add the function to the global object
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
    const adversityControls = html.find('.adversity-controls');
    if (adversityControls.length > 0) {
      const messageToEdit = adversityControls.data-roll-id;
      const actorId = adversityControls.find(".take-adversity").data("actor-id");
  
      // Bind event listeners for the controls
      adversityControls.find(".take-adversity").off("click").click((event) => {
        _onTakeAdversityToken(event);
      });
  
      adversityControls.find(".spend-adversity").off("click").click((event) => {
        _onSpendAdversityTokens(event, messageToEdit);
      });
    }
  });
  

  
  

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

Hooks.once('ready', function() {
  game.socket.on('system.kids-on-brooms', async (data) => {
    console.log("Socket data received:", data);

    if (data.action === "spendTokens") {
      console.log(`Request to spend tokens: ${data.tokensToSpend} tokens for ${data.rollActorId} by ${data.spendingActorId}`);

      // Only handle the request if the GM is logged in
      if (!game.user.isGM) {
        console.log("Not GM, ignoring the token spend request.");
        return;
      }

      const rollActor = game.actors.get(data.rollActorId);  // The actor who made the roll
      const spendingActor = game.actors.get(data.spendingActorId);  // The actor who is spending tokens

      if (!rollActor || !spendingActor) {
        console.warn("Actor not found:", data.rollActorId, data.spendingActorId);
        return;
      }

      // Create a confirmation dialog for the GM
      new Dialog({
        title: "Approve Adversity Token Spending?",
        content: `<p>${spendingActor.name} wants to spend ${data.tokenCost} adversity tokens on ${rollActor.name}'s roll to increase it by ${data.tokensToSpend}. Approve?</p>`,
        buttons: {
          yes: {
            label: "Yes",
            callback: async () => {
              const currentTokens = spendingActor.system.adversityTokens || 0;

              // Update the spending actor's adversity token count
              await spendingActor.update({ "system.adversityTokens": currentTokens - data.tokenCost });

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

              console.log(`${spendingActor.name} spent ${data.tokensToSpend} tokens, updated roll total to ${roll.cumulativeTotal}`);
              ui.notifications.info(`${spendingActor.name} successfully spent ${data.tokensToSpend} tokens.`);
            }
          },
          no: {
            label: "No",
            callback: () => {
              ui.notifications.info(`The GM denied ${spendingActor.name}'s request to spend tokens.`);
            }
          }
        },
        default: "yes"
      }).render(true);
    }
  });
});


async function _onTakeAdversityToken(e) {
  e.preventDefault();

  // Get the actor who made the roll
  const actorId = e.currentTarget.dataset.actorId;
  const actor = game.actors.get(actorId);

  // Get the current player's user ID
  const userId = game.user.id;
  

  // Retrieve the message that this button is attached to
  const messageId = $(e.currentTarget).closest('.message').data('message-id');
  const message = game.messages.get(messageId);

  // Add an adversity token to the actor
  const currentTokens = actor.system.adversityTokens || 0;
  await actor.update({ "system.adversityTokens": currentTokens + 1 });

  // Remove the "Take Adversity Token" button from the chat message
  $(e.currentTarget).remove();

  // Notify the user
  ui.notifications.info(`You gained 1 adversity token.`);
}

async function _onSpendAdversityTokens(e, rollMessageId) {
  const rollActorId = e.currentTarget.dataset.actorId; // The actor who made the roll
  const rollActor = game.actors.get(rollActorId);
  
  // Get the actor of the player who is spending tokens
  const spendingPlayerActor = game.actors.get(game.user.character);  // Assuming player's own actor

  const tokenInput = $(e.currentTarget).closest('.adversity-controls').find('.token-input').val();
  const tokensToSpend = parseInt(tokenInput, 10);

  if (isNaN(tokensToSpend) || tokensToSpend <= 0) {
    ui.notifications.warn("Please enter a valid number of tokens.");
    return;
  }

  let tokenCost = tokensToSpend;

  // If the player spending tokens is not the owner of the actor who rolled, they spend double
  if (spendingPlayerActor.id !== rollActorId) {
    tokenCost = tokensToSpend * 2;
  }

  // Ensure the spending actor has enough adversity tokens
  if (spendingPlayerActor.system.adversityTokens < tokenCost) {
    ui.notifications.warn(`You do not have enough adversity tokens.`);
    return;
  }

  // Check if the player owns the actor who made the roll
  if (spendingPlayerActor.id === rollActorId) {
    // The player owns the actor, so they can spend tokens directly without GM approval
    const currentTokens = spendingPlayerActor.system.adversityTokens || 0;

    // Deduct the tokens from the player
    await spendingPlayerActor.update({ "system.adversityTokens": currentTokens - tokenCost });

    // Handle the roll update directly
    const roll = message.rolls[0];

    if (!roll.cumulativeTotal) {
      roll.cumulativeTotal = roll.total;
    }

    roll.cumulativeTotal += tokensToSpend;

    const messageElement = $(`.message[data-message-id="${message.id}"]`);
    const diceTotalElement = messageElement.find('.dice-total');
    diceTotalElement.text(roll.cumulativeTotal);

    console.log(`${spendingPlayerActor.name} spent ${tokensToSpend} tokens, updated roll total to ${roll.cumulativeTotal}`);
    ui.notifications.info(`${spendingPlayerActor.name} spent ${tokensToSpend} tokens to increase the roll total.`);

  } else {
    // The player does not own the actor, so request GM approval to spend the tokens
    console.log(`Requesting to spend ${tokensToSpend} tokens for ${rollActor.name} by ${spendingPlayerActor.name} (cost: ${tokenCost})`);


  // Emit a socket request to spend tokens
  game.socket.emit('system.kids-on-brooms', {
    action: "spendTokens",
    rollActorId: rollActorId,
    spendingActorId: spendingPlayerActor.id,  // Send the player's actor who is spending the tokens
    tokensToSpend: tokensToSpend,
    tokenCost: tokenCost,
    rollId: message.id  // Pass message ID to update the roll result
  });

  ui.notifications.info(`Requested to spend ${tokenCost} tokens for ${rollActor.name}`);
}

}
