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

  // Register the helper
  Handlebars.registerHelper('capitalizeFirst', function(string) {
    if (typeof string === 'string') {
      return string.charAt(0).toUpperCase() + string.slice(1);
    }
    return '';
  });

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

  //If there is a new chat message that is a roll we add the adversity token controls
  Hooks.on("renderChatMessage", (message, html, messageData) => {
    const adversityControls = html.find('.adversity-controls');
    if (adversityControls.length > 0) {
      const messageToEdit = adversityControls.data("roll-id");
      // Bind event listeners for the controls
      adversityControls.find(".take-adversity").off("click").click((event) => {

        const actorId = event.currentTarget.dataset.actorId;
        const actor = game.actors.get(actorId);
      
        // Check if the current user owns the actor - They can not claim if they are not
        if (!actor.testUserPermission(game.user, "owner")) {
          ui.notifications.warn("You don't own this character and cannot take adversity tokens.");
          return;
        }

        // Check if the token has already been claimed -- Contigency if the button somehow activates again
        if (message.getFlag("kids-on-brooms", "tokenClaimed")) {
          ui.notifications.warn("This adversity token has already been claimed.");
          return;
        }

        _onTakeAdversityToken(event, actor);
        if (game.user.isGM) {
          let tokenControls = game.messages.get(message.id);
          console.log(tokenControls);
          // Update the chat message content with the button disabled and text changed
          const updatedContent = tokenControls.content.replace(
            `<button class="take-adversity" data-actor-id="${actor.id}">Take Adversity Token</button>`,
            `<button class="take-adversity" data-actor-id="${actor.id}" disabled>Token claimed</button>`
          );
          console.log("Removing Button");
          // Update the message content
          tokenControls.update({ content: updatedContent });
          // Set the flag on the chat message to indicate that the token has been claimed
          tokenControls.setFlag("kids-on-brooms", "tokenClaimed", true);
        } else {
          // Emit a socket request to update the message to show that the token has been claimed
          game.socket.emit('system.kids-on-brooms', {
            action: "takeToken",
            messageID: message.id,
            actorID: actor.id,
          });
        }
        console.log("Send socket message for taking a token");
      });
  
      adversityControls.find(".spend-adversity").off("click").click((event) => {
        //This entails a lot more, so I offloaded it to a new function
        _onSpendAdversityTokens(event, messageToEdit);
      });
    }
  });
  

  
  

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/***
 * This handles the incoming socket requests. 
 * If a player wants to spend tokens on another players roll the gm has to approve first
 * if a player wants to claim a token we will update the message since they do not have the permissions
 */
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

      // The actor who made the roll
      const rollActor = game.actors.get(data.rollActorId);  
      // The actor who is spending tokens
      const spendingActor = game.actors.get(data.spendingActorId);  

      //If these for some reason do not exist
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

              
              // Modify the roll message with the new total
              await _updateRollMessage(data.rollMessageId, data.tokensToSpend, false);

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
    } else if (data.action === "takeToken") {
      // Only handle the request if the GM is logged in
      if (!game.user.isGM) {
        console.log("Not GM, ignoring the token spend request.");
        return;
      }
      let tokenControls = game.messages.get(data.messageID);
      console.log(tokenControls);
      // Update the chat message content with the button disabled and text changed
      const updatedContent = tokenControls.content.replace(
        `<button class="take-adversity" data-actor-id="${data.actorID}">Take Adversity Token</button>`,
        `<button class="take-adversity" data-actor-id="${data.actorID}" disabled>Token claimed</button>`
      );
      console.log("Removing Button");
      // Update the message content
      tokenControls.update({ content: updatedContent });
      // Set the flag on the chat message to indicate that the token has been claimed
      tokenControls.setFlag("kids-on-brooms", "tokenClaimed", true);
    }
  });
});

/***
 * This function adds the adversity token to the actor that made the roll and logs it
 * 
 * @param {Event} e - The button click event
 * @param {Actor} actor - The actor object that made the roll  
 */
async function _onTakeAdversityToken(e, actor) {
  e.preventDefault();


  // Get the chat message ID (assuming it's stored in the dataset)
  const messageId = e.currentTarget.closest('.message').dataset.messageId;
  const message = game.messages.get(messageId);

  // Add an adversity token to the actor
  const currentTokens = actor.system.adversityTokens || 0;
  await actor.update({ "system.adversityTokens": currentTokens + 1 });


  // Notify the user
  ui.notifications.info(`You gained 1 adversity token.`);
  console.log(`Gave one adversity token to ${actor.id}`)
}

/***
 * This function allows players to spend tokens to change a roll. This will automatically be calculated in their sheet
 * 
 */
async function _onSpendAdversityTokens(e, rollMessageId) {
  e.preventDefault();
  
   // The actor who made the roll
  const rollActorId = e.currentTarget.dataset.actorId;
  const rollActor = game.actors.get(rollActorId); //technically redundant since it is also done in the main hook, but perfomance is good enuff

  // Get the actor of the player who is spending tokens
  const spendingPlayerActor = game.actors.get(game.user.character?.id || game.actors.filter(actor => actor.testUserPermission(game.user, "owner"))[0]?.id);

  if (!spendingPlayerActor) {
    ui.notifications.warn("You don't control any actors.");
    return;
  }

  //Get the tokens to be spend from the input field
  const tokenInput = $(e.currentTarget).closest('.adversity-controls').find('.token-input').val();
  const tokensToSpend = parseInt(tokenInput, 10);

  if (isNaN(tokensToSpend) || tokensToSpend <= 0) {
    ui.notifications.warn("Please enter a valid number of tokens.");
    return;
  }

  let tokenCost = tokensToSpend;

  // If the player spending tokens is not the owner of the actor who rolled, they spend double 
  //(note, this is a rule of mine, I have disabled it by default)
  if ((!spendingPlayerActor.testUserPermission(game.user, "owner") || spendingPlayerActor.id !== rollActorId) && false) {
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

    // Modify the roll message with the new total
    await _updateRollMessage(rollMessageId, tokensToSpend, true);

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
      rollMessageId: rollMessageId  // Pass message ID to update the roll result
    });

    ui.notifications.info(`Requested to spend ${tokenCost} tokens for ${rollActor.name}`);
  }
}

// Helper function to send a new message with the updated roll result
async function _updateRollMessage(rollMessageId, tokensToSpend, isPlayerOfActor) {
  const message = game.messages.get(rollMessageId);

  if (!message) {
    console.error("Message not found with ID:", rollMessageId);
    return;
  }
  
  // Retrieve current tokens spent from flags, or initialize to 0 if not found
  let cumulativeTokensSpent = message.getFlag("kids-on-brooms", "tokensSpent") || 0;
  let newTotal = message.getFlag("kids-on-brooms", "newRollTotal") || message.rolls[0].total;

  /*if(isPlayerOfActor)
  {
    // Add the new tokens to the cumulative total
    cumulativeTokensSpent += tokensToSpend;
  } else {
    cumulativeTokensSpent += 2*tokensToSpend;
  }*/
  cumulativeTokensSpent += tokensToSpend;
  newTotal += tokensToSpend;
  await message.setFlag("kids-on-brooms", "newRollTotal", newTotal);

  // Update the message's flags to store the cumulative tokens spent
  await message.setFlag("kids-on-brooms", "tokensSpent", cumulativeTokensSpent);
  let newContent = "";
  if(cumulativeTokensSpent === 1)
  {
    newContent = `You have now spent ${cumulativeTokensSpent} token. The new roll total is ${newTotal}.`;
  } else {
    newContent = `You have now spent ${cumulativeTokensSpent} tokens. The new roll total is ${newTotal}.`;
  }

  // Create a new chat message to display the updated total
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: message.speaker.actor }),
    content: newContent,
    type: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });
}