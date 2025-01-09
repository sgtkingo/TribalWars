// ==UserScript==
// @name         Plunderer
// @namespace    http://tampermonkey.net/
// @version      2025-01-06
// @description  try to take over the world!
// @author       You
// @match        https://cs100.divokekmeny.cz/game.php?village=10365&screen=am_farm
// @icon         https://www.google.com/s2/favicons?sz=64&domain=divokekmeny.cz
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    //First trigger auto-plunderer
    setTimeout(Plunderer, getRandomInterval(1000, 2000));
})();

//Global vars
const plunderingModes = {"fast":30, "optimal":60, "slow":120, "custom":0}
const serverTimezoneOffset = 1; // For UTC+1 (Central European Time)
//Village info
var availableArmy = {"light":0, "spear":0, "axe":0}
var plunderedVillages = []

//Config
const userConfig = {"mode":"fast", "strategy":"auto"}
const reserveUnits = {"light":100, "spear":500, "axe":1000}

//Teplates
var templateA = {"light":0, "spear":0, "axe":0, "potencial":0}
var templateB = {"light":0, "spear":0, "axe":0, "potencial":0}

/**
 * Function to detect if it is night (00:00 to 06:00) in a specific timezone.
 * @param {number} timezoneOffset - The timezone offset in hours (e.g., +1 for UTC+1, -5 for UTC-5).
 * @returns {boolean} - Returns true if it's night, false otherwise.
 */
function isNight(timezoneOffset) {
    // Get the current UTC time
    let now = new Date();
    let utcHours = now.getUTCHours();  // Current hour in UTC

    // Convert UTC time to local time in the given timezone
    let localHours = utcHours + timezoneOffset;

    // Handle overflow of hours (e.g., negative or above 24)
    if (localHours < 0) {
        localHours += 24;
    } else if (localHours >= 24) {
        localHours -= 24;
    }

    // Return true if time is between 00:00 and 06:00
    return localHours >= 0 && localHours < 6;
}

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

function updatePlunderingTemplates() {
    console.log("(>)Updating templates information...")
    // Select the table with class "vis"
    let table = document.querySelector('table.vis');
    if (!table) {
        console.error('Table with templates not found!');
        return;
    }

    let rows = table.querySelectorAll('tr');  // Get all rows (tr) in the table

    // Extract data from the 2nd row for template A
    let templateARow = rows[1];  // 2nd row (0-indexed)
    templateA = extractTemplateData(templateARow);

    // Extract data from the 4th row for template B
    let templateBRow = rows[3];  // 4th row (0-indexed)
    templateB = extractTemplateData(templateBRow);

    console.log("\t*Template A:", templateA);
    console.log("\t*Template B:", templateB);
}

// Dictionary to store available army in the village
var availableArmy = {"light": 0, "spear": 0, "axe": 0};

// Function to update availableArmy from the table
function updateAvailableArmy(log=true) {
    if(log){
        console.log("(>)Updating avaible army information...")
    }
    // Select the table with id "units_home"
    let table = document.querySelector('#units_home');
    if (!table) {
        console.error('(i)Table with id "units_home" not found!');
        return;
    }

    // Update values for each unit type
    for (let unitType in availableArmy) {
        let unitCell = table.querySelector(`td[id="${unitType}"]`);  // Select the <td> by id (e.g., "spear", "light", "axe")
        if (unitCell) {
            let unitCount = parseInt(unitCell.textContent.trim().replace(/\./g, '')) || 0;  // Convert text to integer, handle thousands separators
            availableArmy[unitType] = unitCount;  // Update the dictionary with the new value
        } else {
            console.warn(`(!)No table cell found for unit type "${unitType}"`);
        }
    }

    if(log){
        console.log("(i)Updated available army:", availableArmy);
    }
}

function extractTemplateData(row) {
    let template = {"light": 0, "spear": 0, "axe": 0, "potencial": 0};

    let columns = row.querySelectorAll('td');  // Get all columns (td) in the row

    // Iterate over each column
    columns.forEach((column, index) => {
        // Check if there's an input field for unit amounts
        let inputField = column.querySelector('input[name*="spear"], input[name*="light"], input[name*="axe"]');
        if (inputField) {
            let unitType = inputField.name;  // Get the name of the input (e.g., "spear", "light", "axe")
            let unitValue = parseInt(inputField.value.trim()) || 0;  // Convert value to int, default to 0
            if (unitType.includes("spear")) template.spear = unitValue;
            if (unitType.includes("light")) template.light = unitValue;
            if (unitType.includes("axe")) template.axe = unitValue;
        }

        // Check the last column for the total plundering potential
        if (index === columns.length - 1) {
            let potencialValue = parseInt(column.textContent.trim()) || 0;  // Get the text content as int
            template.potencial = potencialValue;
        }
    });

    return template;  // Return the filled template dictionary
}

function checkAvaibleArmy(template)
{
    //Update avaible army 
    updateAvailableArmy(false);
    for(let unit in template){
        //Scip unused units
        if( template[unit] == 0 ){
            continue;
        }

        if(template[unit] > availableArmy[unit] || availableArmy[unit] <= reserveUnits[unit]){
            return false;
        }
    }
    return true;
}

async function Autoplunder(config){
    return new Promise(async (resolve, reject) => {
        console.log("(>)Scanning for vilages to plundering...")
        let table = document.querySelector('#plunder_list');  // Select the table with id "plunder_list"
        if (!table) {
            reject('(i)Table with id "plunder_list" not found!');
            return;
        }
    
        let rows = table.querySelectorAll('tr');  // Get all rows in the table
        if( rows.length <= 2 ){
            reject("(!) No villages to plundering!");
        }
        //Autostop
        if( rows.length-2 == plunderedVillages.length ){
            reject("(i)All plunderers send, no new village to plunder!");
            return;
        }
    
        for (let i = 2; i < rows.length; i++) {  // Start from 3rd row (0-indexed as 2)
            if( !checkAvaibleArmy(templateA) && !checkAvaibleArmy(templateB) ){
                reject("(!) Not enought army, or limit reach, to plundering!");
                return;
            }
            // Extract data from the current row
            let row = rows[i];
            let columns = row.querySelectorAll('td');

            //Get vilage info
            let vilageColumn = columns[3]; // 4th column (0-indexed as 3)
            let vilageInfo = vilageColumn.querySelector('a');
            let vilageInfoText = "unknown";
            if(vilageInfo)
            {
                vilageInfoText = vilageInfo.textContent.trim();
            }
            if(plunderedVillages.includes(vilageInfoText)){
                continue;
            }
    
            // **1. Calculate `potencial_loot` (sum of resources in the 6th column)**
            let resourceColumn = columns[5];  // 6th column (0-indexed as 5)
            let spans = resourceColumn.querySelectorAll('span.nowrap');  // Spans containing resource amounts
            let potencial_loot = 0;
    
            spans.forEach(span => {
                let resourceSpan = span.querySelector('span.res');  // Get the actual span with the resource number
                if (!resourceSpan) return;  // Skip if no resource span found
    
                let mainText = resourceSpan.textContent.trim();  // Get the text in the span.res
    
                let greySpan = resourceSpan.querySelector('span.grey');  // Check if there's a nested span.grey
                if (greySpan) {
                    // Case: Number is split into thousands
                    let fractionalText = greySpan.textContent.trim();  // Get the text in the span.grey
                    let fullNumberText = mainText + fractionalText;  // Concatenate main + fractional parts
                    let fullNumber = parseInt(fullNumberText.replace(/\./g, '')) || 0;  // Convert to int
                    potencial_loot += fullNumber;
                } else {
                    // Case: Number is directly in span.res
                    let resourceAmount = parseInt(mainText.replace(/\./g, '')) || 0;
                    potencial_loot += resourceAmount;  // Add to the total potential loot
                }
            });
    
            console.log(`\t\t*Found village: ${vilageInfoText} with potencial loot = ${potencial_loot}`);
    
            // **2. Select the right button (A or B) based on updated decision logic**
            let buttonA = columns[8].querySelector('a');  // 9th column (0-indexed as 8) - button A
            let buttonB = columns[9].querySelector('a');  // 10th column (0-indexed as 9) - button B
    
            if (!buttonA || !buttonB) {
                console.warn(`(!)Buttons A or B not found in row ${i + 1}`);
                continue;
            }
            
            switch(config["strategy"])
            {
                case "A":
                    console.error("(!)Strategy A is not implemented yet!");
                    break;
                case "B":
                    console.error("(!)Strategy A is not implemented yet!");
                    break;
                case "auto":
                    if(isNight(serverTimezoneOffset) & checkAvaibleArmy(templateB)){
                        console.log("\t\t\t(•)Night time, using strategy B...");
                        console.log(`\t\t\t>Sending B to vilagge ${vilageInfoText}`);
                        buttonB.click();  // Click button B 
                    }
                    else
                    {
                        console.log("\t\t\t(○)Day time, using strategy A...");
                        console.log(`\t\t\t>Sending A to vilagge ${vilageInfoText}`);
                        buttonA.click();  // Click button A
                    }
                    break;
                case "loot":
                    if ((potencial_loot <= templateA["potencial"] * 2) & checkAvaibleArmy(templateA)) {
                        console.log("\t\t\t Potencial loot is low, using strategy A...");
                        console.log(`\t\t\t >Sending A to vilagge ${vilageInfoText}`);
                        buttonA.click();  // Click button A if loot is within 2x the potential of template A
                    } else {
                        console.log("\t\t\t Potencial loot is high, using strategy B...");
                        console.log(`\t\t\t >Sending B to vilagge ${vilageInfoText}`);
                        buttonB.click();  // Click button B if loot exceeds 2x the potential of template A
                    }
                    break;
                default:
                    console.error("(!)Unknown stragety, switching to auto...");
                    config["strategy"] = "auto";
                    break;
            }
            plunderedVillages.push(vilageInfoText);
            await sleep(getRandomInterval(250, 500));  // Delay to simulate natural behavior
        }
        resolve("\t(i)Plunderers wave send!");
    });
}

async function Plunderer(config=userConfig) {
    //Script start
    console.log("(*)Plunderer triggered, config:", config);
    plunderedVillages = []
    //Update templates status
    updatePlunderingTemplates();
    console.log("(i)Your reserve army limits are set to:", reserveUnits);
    await sleep(100);

    //Autoplundering
    try {
        let result = await Autoplunder(config);
        console.log(result);
        await sleep(1000);
    } catch (error) {
        console.error(error);
    }

    // Schedule the next click with a preconfig randomize interval
    let mins = plunderingModes[config["mode"]]+getRandomInterval(1, 5);
    let interval = minsToMs(mins);
    // Get the current UTC time
    let now = new Date();
    console.log(`(>)Next auto-plunderer starts in ${mins} mins...`, now);
    await sleep(interval);
    location.reload();  // Refreshes the page
    //setTimeout(Plunderer, interval);
}