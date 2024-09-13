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

  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.kidsonbrooms = {
    KidsOnBroomsActor
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


  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});


