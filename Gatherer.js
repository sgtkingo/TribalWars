// ==UserScript==
// @name         Gatherer
// @namespace    http://tampermonkey.net/
// @version      2025-01-03
// @description  try to take over the world!
// @author       You
// @match        https://cs100.divokekmeny.cz/game.php?village=10365&screen=place&mode=scavenge
// @icon         https://www.google.com/s2/favicons?sz=64&domain=divokekmeny.cz
// @grant        none
// ==/UserScript==
(function() {
    'use strict';
    // Automatic start in 1-2sec
    setTimeout(Gathering, getRandomInterval(1000, 2000));
})();

//Define global vars
var gatheringTiers = {"Líní sběrači":8, "Běžní sběrači":4, "Chytří sběrači":2, "Velcí sběrači":1}
var gatheringModes = {"fast":60, "optimal":120, "slow":240, "night":480}
var unitsCapacity = {"light":80, "spear":25, "axe":10}

//Settings
/**
 * User Configuration for Scavenging Behavior
 *
 * Options:
 *
 * - `mode` (string): Defines the speed and behavior of the scavenging mode.
 *   - `"fast"`: Prioritize fast, frequent gathering cycles (recommended).
 *   - `"optimal"`: Balanced approach between gathering speed and efficiency.
 *   - `"slow"`: Longer, more resource-heavy gathering cycles.
 *   - `"night"`: Special mode for overnight, slower gathering with lower activity.
 *
 * - `strategy` (string): Specifies the strategy to use for scavenging.
 *   - `"auto"`: Automatically determine the best units based on availability.
 *   - `"predefined"`: Use a predefined unit composition (specified in predefinedUnits).
 *   - `"light"`: Use light cavalry units - high capacity per unit, need lower amount.
 *   - `"axe"`: Use axe units for gathering - low capacity per unit, need very high amount.
 *   - `"spear"`: Use spear units - avarage capacity per unit.
 *
 * - `tiers` (string or array): Defines the scavenging tiers (difficulty levels).
 *   - `"auto"`: Automatically select the best available tiers.
 *   - `string[]`: An array of specific tiers (e.g., `["Běžní sběrači", "Chytří sběrači"]`).
 */
var userConfig = {"mode":"optimal", "strategy":"predefined", "tiers":"auto"}
var predefinedUnits = {"Líní sběrači":{"axe":1400, "light":60}, "Běžní sběrači":{"light":100}, "Chytří sběrači":{"light":50}, "Velcí sběrači":{"light":25}}

//Define functions
// Sleep function that returns a promise resolved after a given time (in milliseconds)
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//Convrt mins to ms
function minsToMs(mins)
{
    return mins*60*1000;
}

// Function to generate a random interval between min and max milliseconds
function getRandomInterval(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Calculate units amount based on config
function calculateUnits(config, tier)
{
    console.log("\t\t\t...doing some calculation...");
    var units = []

    let strategy = config["strategy"];
    let mode = gatheringModes[config["mode"]];

   //6400 == 60min
    let needed_capacity = 6400 * (mode/60) * gatheringTiers[tier];
    let needed_unit_amount = 0;
    console.log(`\t\t(i)strategy:${strategy}, mode:${mode}, tier:${tier}, needed_capacity:${needed_capacity}...`);

    switch (strategy) {
        case 'auto':
            needed_unit_amount = Math.ceil((needed_capacity/2.0)/unitsCapacity['axe']);
            units.push(Object.freeze(['axe', needed_unit_amount]));
            needed_unit_amount = Math.ceil((needed_capacity/2.0)/unitsCapacity['light']);
            units.push(Object.freeze(['light', needed_unit_amount]));
            break;
        case 'predefined':
            for(let k in predefinedUnits[tier])
            {
                units.push(Object.freeze([k, predefinedUnits[tier][k]]));
            }
            break;
        case 'light':
            needed_unit_amount = Math.ceil(needed_capacity/unitsCapacity['light']);
            units.push(Object.freeze(['light', needed_unit_amount]));
            break;
        default:
            console.log(`Unknown strategy "${strategy}"`);
            break;
    }

    return units;
}

async function clearAllFields()
{
    return new Promise(async (resolve, reject) => {
        try {
            await typeUnits("light", 0);
            await typeUnits("axe", 0);
            await typeUnits("spear", 0);
        }
        catch(error)
        {
            reject(error);
        }

        resolve("All fields cleared...");
    });
}

//Type units to input field
async function typeUnits(type, amount)
{
    return new Promise(async (resolve, reject) => {
        console.log(`\t\t\t...Typing units ${type}:${amount}...`);
        //console.log(`\t\t\t...typing...`);

        let inputField = document.querySelector(`input[name="${type}"]`);  // Selects the input field with name="type"
        if (inputField)
        {
            inputField.click();  // Simulate a click inside the input field
            await sleep(getRandomInterval(400, 600));  // Optional: small delay to simulate natural behavior
            inputField.value = "";  // Clear the current value

            for (let char of amount.toString()) {
                // Create and dispatch keyboard events to simulate real typing
                let keyDownEvent = new KeyboardEvent('keydown', { key: char, bubbles: true });
                let keyPressEvent = new KeyboardEvent('keypress', { key: char, bubbles: true });
                let keyUpEvent = new KeyboardEvent('keyup', { key: char, bubbles: true });

                inputField.dispatchEvent(keyDownEvent);
                inputField.value += char;  // Add the character to the input field value
                inputField.dispatchEvent(keyPressEvent);
                inputField.dispatchEvent(new Event('input', { bubbles: true }));  // Trigger input event
                inputField.dispatchEvent(keyUpEvent);

                //console.log(`Typed character: ${char}`);
                await sleep(getRandomInterval(150, 250));  // Wait random delay between keystrokes
            }
            resolve("Typing complete - success!");
        }
        else
        {
            reject("Input field for typing not found!");
        }
    });
}

async function setUnits(units)
{
    return new Promise(async (resolve, reject) => {
        console.log(`\t\t\t>Prepairing ${units} [${units.length}]`);
        //Clear fields
        try {
            let result = await clearAllFields();
            console.log(`\t\t\t>${result}`);
        } catch (error) {
            reject(error);
        }

        //Type units type by type
        for(let i = 0; i < units.length; i++)
        {
            //console.log(units[i]);
            let [type, amount] = units[i];
            //Type unit into the field
            try {
                await typeUnits(type, amount);
            } catch (error) {
                reject(error);
            }
            await sleep(getRandomInterval(400, 600));  // Optional: small delay to simulate natural behavior
        }
        resolve("\t\t\t>All units set!");
    });
}

async function startGathering(option)
{
    return new Promise(async (resolve, reject) => {
        // Find the button inside the nested structure
        let button = option.querySelector(
            '.status-specific .inactive-view .action-container .btn.btn-default.free_send_button'
        );
        if (button) {
            await sleep(getRandomInterval(400, 600));  // Optional: small delay to simulate natural behavior
            button.click(); // Click the button

            resolve("\t\t>Units send to gathering!");
        } else {
            reject("(!) Button not found in the selected scavenge option!");
        }
    });
}

// Function to find and click the desired button
async function Autofinder(config) {
    return new Promise(async resolve => {
        console.log("(i)Searching for avaible gathering options...")
        // Find all divs with the class "scavenge-option border-frame-gold-red"
        let scavengeOptions = document.querySelectorAll('.scavenge-option.border-frame-gold-red');
        for (let option of scavengeOptions) {  // Use `for...of` instead of `forEach`
            let titleDiv = option.querySelector('.title');
            let tier = titleDiv.textContent.trim();
            console.log("\t*Found " + tier);

            // Check the tiers configuration
            if (config["tiers"] != "auto" && !config["tiers"].includes(tier)) {
                console.log("\t\tignoring...");
            } else {
                if (tier in gatheringTiers) {
                    console.log(`\t(i)Starting gathering: ${tier}...`);
                    // Prepare units
                    let units = calculateUnits(config, tier);
                    try {
                        let result = await setUnits(units);
                        console.log(result);
                        // Start gathering
                        try {
                            let result = await startGathering(option);
                            console.log(result);
                        } catch (error) {
                            console.error(error);
                        }
                    } catch (error) {
                        console.error(error);
                    }
                    await sleep(getRandomInterval(1000, 2000));  // Small delay to simulate natural behavior
                }
            }
        }
        resolve("(i)>Gathering cycle is DONE!");
    });
}

async function Gathering(config=userConfig) {
    //Autogathering
    /*
    try {
        let result = await Autofinder(config);
        console.log(result);
    } catch (error) {
        console.error(error);
    }
    */

    // Schedule the next click with a preconfig randomize interval
    let mins = gatheringModes[config["mode"]]+getRandomInterval(5, 10);
    let interval = minsToMs(mins);
    console.log(`(i)Next auto-gathering starts in ${mins} mins...`);
    setTimeout(Gathering, interval);
}

