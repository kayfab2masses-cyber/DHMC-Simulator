// Wait for the HTML page to fully load before running code
document.addEventListener('DOMContentLoaded', () => {
    // Find our button and log output
    const runButton = document.getElementById('run-button');
    const logOutput = document.getElementById('log-output');

    // Add a click listener to the button
    runButton.addEventListener('click', runSimulation);
});

/**
 * Main function to run the simulation.
 */
async function runSimulation() {
    // Clear the log for a new run
    logOutput.textContent = '';
    logToScreen('Simulation starting...');

    try {
        // --- 1. LOAD DATA ---
        // Fetch our character and adversary JSON files
        const monteResponse = await fetch('data/monte_lvl_1.json');
        const monte = await monteResponse.json();
        logToScreen(`Loaded Character: ${monte.name} (Lvl ${monte.level} ${monte.class})`);

        const wolfResponse = await fetch('data/dire_wolf.json');
        const direWolf = await wolfResponse.json();
        logToScreen(`Loaded Adversary: ${direWolf.name} (Difficulty ${direWolf.difficulty})`);

        // --- 2. RUN SIMULATION LOGIC ---
        // This is a test. Let's simulate Monte trying to "Enrapture" the Dire Wolf.
        // The "Enrapture" card requires a Spellcast Roll. [cite: 48108]
        // Monte's Spellcast Trait is Presence [cite: 42887], which is +2[cite: 42884].
        // The target is the Dire Wolf, so the Difficulty is 12. [cite: 45706]
        
        logToScreen('\n--- TEST 1: Monte attempts to "Enrapture" the Dire Wolf ---');
        logToScreen(`Rolling with ${monte.spellcastTrait} (Modifier: ${monte.traits[monte.spellcastTrait]})`);
        logToScreen(`Target Difficulty: ${direWolf.difficulty}`);

        // Get the character's trait modifier
        const traitModifier = monte.traits[monte.spellcastTrait]; // This will be 2
        
        // Execute the core mechanic
        const result = executeActionRoll(direWolf.difficulty, traitModifier, 0);

        // --- 3. PROCESS OUTCOME ---
        // This is the "Outcome Determination Logic" from your doc [cite: 42628-42641]
        logToScreen(`\nRoll Result: ${result.hopeRoll} (Hope) vs ${result.fearRoll} (Fear)`);
        logToScreen(`Total Roll: ${result.total} (vs ${result.difficulty})`);
        logToScreen(`Outcome: ${result.outcome}`);

        // This is where we'll build the resource feedback loop
        switch(result.outcome) {
            case 'Critical Success':
                logToScreen('Monte gains 1 Hope and clears 1 Stress.'); // [cite: 42633]
                break;
            case 'Success with Hope':
                logToScreen('Monte gains 1 Hope.'); // [cite: 42635]
                break;
            case 'Success with Fear':
                logToScreen('GM gains 1 Fear.'); // [cite: 42637]
                break;
            case 'Failure with Hope':
                logToScreen('Monte gains 1 Hope. Spotlight passes to GM.'); // [cite: 42639]
                break;
            case 'Failure with Fear':
                logToScreen('GM gains 1 Fear. Spotlight passes to GM.'); // [cite: 42641]
                break;
        }

    } catch (error) {
        logToScreen(`\n--- ERROR ---
        ${error.message}
        
        Did you remember to create the .json files in the /data/ folder?`);
        console.error(error);
    }
}

/**
 * Helper function to print messages to the on-screen log
 * @param {string} message - The text to log.
 */
function logToScreen(message) {
    // Find the log output element *inside* the function
    // This is safer in case the script runs before the element exists
    const logOutput = document.getElementById('log-output');
    if (logOutput) {
        logOutput.textContent += message + '\n';
    }
}

/**
 * Rolls a virtual 12-sided die. [cite: 42601]
 * @returns {number} A random integer between 1 and 12.
 */
function rollD12() {
    return Math.floor(Math.random() * 12) + 1;
}

/**
 * This is the Core Resolution Engine. 
 * It models the Duality Dice system and determines the outcome. [cite: 42600]
 *
 * @param {number} difficulty - The target Difficulty number. [cite: 42617]
 * @param {number} traitModifier - The character's relevant trait modifier (e.g., +2). [cite: 42616]
 * @param {number} otherModifiers - Any other modifiers (e.g., from Experiences or d6s). [cite: 42619-42621]
 * @returns {object} An object containing the full results of the roll.
 */
function executeActionRoll(difficulty, traitModifier, otherModifiers) {
    // 4. Roll Dice [cite: 42622]
    const hopeRoll = rollD12();
    const fearRoll = rollD12();

    // 5. Resolve Outcome [cite: 42623]
    const baseSum = hopeRoll + fearRoll;
    const total = baseSum + traitModifier + otherModifiers;

    let outcome = '';

    // The Conditional Matrix [cite: 42629]
    
    // Check for Critical Success first [cite: 42631]
    if (hopeRoll === fearRoll) {
        outcome = 'Critical Success';
    } 
    // Check for Numerical Success [cite: 42624]
    else if (total >= difficulty) { 
        if (hopeRoll > fearRoll) {
            outcome = 'Success with Hope'; // [cite: 42634]
        } else {
            outcome = 'Success with Fear'; // [cite: 42636]
        }
    } 
    // Check for Numerical Failure [cite: 42624]
    else { 
        if (hopeRoll > fearRoll) {
            outcome = 'Failure with Hope'; // [cite: 42638]
        } else {
            outcome = 'Failure with Fear'; // [cite: 42640]
        }
    }

    // Return a detailed object for the log
    return {
        hopeRoll: hopeRoll,
        fearRoll: fearRoll,
        baseSum: baseSum,
        traitModifier: traitModifier,
        otherModifiers: otherModifiers,
        total: total,
        difficulty: difficulty,
        outcome: outcome
    };
}