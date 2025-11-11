// --- GLOBAL STATE ---
let playerPool = []; // Column 2: Player Library
let adversaryPool = []; // Column 2: Adversary Library
let activeParty = []; // Column 3: Players in the next sim
let activeAdversaries = []; // Column 3: Adversaries in the next sim
let SRD_ADVERSARIES = []; // This will hold our loaded SRD database

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Column 1 Buttons
    document.getElementById('add-character-button').addEventListener('click', addCharacterToPool);
    document.getElementById('add-adversary-button').addEventListener('click', addAdversaryToPool);
    document.getElementById('run-button').addEventListener('click', runSimulation);
    // Column 2 & 3 Buttons
    document.getElementById('pool-column').addEventListener('click', handlePoolClick);
    document.getElementById('scene-column').addEventListener('click', handleSceneClick);
    document.getElementById('remove-character-button').addEventListener('click', removeLastCharacter);
    document.getElementById('remove-adversary-button').addEventListener('click', removeLastAdversary);
    // SRD Modal Listeners
    document.getElementById('open-srd-modal').addEventListener('click', openSRDModal);
    document.getElementById('close-srd-modal').addEventListener('click', closeSRDModal);
    document.getElementById('srd-modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'srd-modal-overlay') closeSRDModal();
    });
    document.getElementById('srd-tier-filter').addEventListener('change', renderSRDAdversaries);
    document.getElementById('srd-type-filter').addEventListener('change', renderSRDAdversaries);
    document.getElementById('srd-adversary-list').addEventListener('click', handleSRDListClick);

    loadSRDDatabase(); 
    renderPools();
    renderActiveScene();
});

// --- DATA & POOL MANAGEMENT ---

async function loadSRDDatabase() {
    try {
        const response = await fetch('data/srd_adversaries.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        SRD_ADVERSARIES = data.adversaries; // Correctly read the nested array
        logToScreen(`Successfully loaded ${SRD_ADVERSARIES.length} adversaries from SRD catalog.`);
        renderSRDAdversaries(); 
    } catch (error) {
        logToScreen(`--- FATAL ERROR --- Could not load SRD Adversary JSON: ${error.message}`);
        console.error("Failed to fetch SRD data:", error);
    }
}

function addCharacterToPool() {
    const jsonTextBox = document.getElementById('character-json');
    try {
        const newCharacter = JSON.parse(jsonTextBox.value);
        if (!newCharacter.name || !newCharacter.traits) throw new Error('JSON missing "name" or "traits"');
        const isDuplicate = playerPool.some(p => p.name === newCharacter.name);
        if (isDuplicate) {
            logToScreen(`--- ERROR --- \nA player named '${newCharacter.name}' is already in the pool.`);
            return;
        }
        newCharacter.simId = `player-${Date.now()}`;
        playerPool.push(newCharacter);
        logToScreen(`Added ${newCharacter.name} to Player Pool.`);
        jsonTextBox.value = '';
        renderPools();
    } catch (e) { logToScreen(`--- ERROR --- \nInvalid Character JSON. ${e.message}`); }
}

function addAdversaryToPool() {
    const jsonTextBox = document.getElementById('adversary-json');
    try {
        const newAdversary = JSON.parse(jsonTextBox.value);
        if (!newAdversary.name || !newAdversary.difficulty) throw new Error('JSON missing "name" or "difficulty"');
        const isDuplicate = adversaryPool.some(a => a.name === newAdversary.name);
        if (isDuplicate) {
            logToScreen(`--- ERROR --- \nAn adversary named '${newAdversary.name}' is already in the pool.`);
            return;
        }
        newAdversary.simId = `adv-master-${Date.now()}`;
        adversaryPool.push(newAdversary);
        logToScreen(`Added ${newAdversary.name} to Adversary Pool.`);
        jsonTextBox.value = '';
        renderPools();
    } catch (e) { logToScreen(`--- ERROR --- \nInvalid Adversary JSON. ${e.message}`); }
}

function removeLastCharacter() {
    if (playerPool.length > 0) {
        const removedChar = playerPool.pop();
        logToScreen(`Removed ${removedChar.name} from player pool.`);
        renderPools();
    } else { logToScreen("Player pool is already empty."); }
}

function removeLastAdversary() {
    if (adversaryPool.length > 0) {
        const removedAdv = adversaryPool.pop();
        logToScreen(`Removed ${removedAdv.name} from adversary pool.`);
        renderPools();
    } else { logToScreen("Adversary pool is already empty."); }
}

// --- DYNAMIC CLICK HANDLERS ---

function handlePoolClick(event) {
    const target = event.target;
    const agentId = target.dataset.id;
    if (!agentId) return; 

    if (target.classList.contains('move-button')) {
        let playerIndex = playerPool.findIndex(p => p.simId === agentId);
        if (playerIndex > -1) {
            const agent = playerPool.splice(playerIndex, 1)[0];
            activeParty.push(agent);
            logToScreen(`Moved ${agent.name} to Active Scene.`);
        } else {
            const agentTemplate = adversaryPool.find(a => a.simId === agentId);
            if (agentTemplate) {
                const newAgentInstance = JSON.parse(JSON.stringify(agentTemplate));
                newAgentInstance.simId = `adv-instance-${Date.now()}`; 
                activeAdversaries.push(newAgentInstance);
                logToScreen(`Copied ${newAgentInstance.name} to Active Scene.`);
            }
        }
    }
    
    if (target.classList.contains('flush-button')) {
        let playerIndex = playerPool.findIndex(p => p.simId === agentId);
        if (playerIndex > -1) {
            logToScreen(`Flushed ${playerPool.splice(playerIndex, 1)[0].name} from pool.`);
        } else {
            let adversaryIndex = adversaryPool.findIndex(a => a.simId === agentId);
            if (adversaryIndex > -1) {
                logToScreen(`Flushed ${adversaryPool.splice(adversaryIndex, 1)[0].name} from pool.`);
            }
        }
    }
    renderPools();
    renderActiveScene();
}

function handleSceneClick(event) {
    const target = event.target;
    const agentId = target.dataset.id;
    if (!agentId) return;

    if (target.classList.contains('move-button')) {
        let playerIndex = activeParty.findIndex(p => p.simId === agentId);
        if (playerIndex > -1) {
            const agent = activeParty.splice(playerIndex, 1)[0];
            playerPool.push(agent);
            logToScreen(`Moved ${agent.name} back to Player Pool.`);
        } else {
            let adversaryIndex = activeAdversaries.findIndex(a => a.simId === agentId);
            if (adversaryIndex > -1) {
                const agent = activeAdversaries.splice(adversaryIndex, 1)[0];
                logToScreen(`Removed ${agent.name} instance from Active Scene.`);
            }
        }
    }
    renderPools();
    renderActiveScene();
}

function handleSRDListClick(event) {
    const target = event.target.closest('.srd-item');
    if (!target) return;
    
    if (event.target.classList.contains('move-button')) {
        const advName = target.dataset.name;
        addAdversaryFromSRD(advName);
    }
}

// --- DYNAMIC UI RENDERING ---

function renderPools() {
    const playerListDiv = document.getElementById('player-pool-list');
    const adversaryListDiv = document.getElementById('adversary-pool-list');
    playerListDiv.innerHTML = '';
    adversaryListDiv.innerHTML = '';
    playerPool.forEach(char => {
        playerListDiv.innerHTML += `
            <div class="pool-item">
                <span class="agent-name">${char.name} (Lvl ${char.level})</span>
                <div>
                    <button class="flush-button" data-id="${char.simId}" title="Remove from Pool">X</button>
                    <button class="move-button" data-id="${char.simId}" title="Add to Active Scene">&gt;</button>
                </div>
            </div>`;
    });
    adversaryPool.forEach(adv => {
        adversaryListDiv.innerHTML += `
            <div class="pool-item">
                <span class="agent-name">${adv.name} (Diff ${adv.difficulty})</span>
                <div>
                    <button class="flush-button" data-id="${adv.simId}" title="Remove from Pool">X</button>
                    <button class="move-button" data-id="${adv.simId}" title="Add to Active Scene">&gt;</button>
                </div>
            </div>`;
    });
}

function renderActiveScene() {
    const partyListDiv = document.getElementById('active-party-list');
    const adversaryListDiv = document.getElementById('active-adversary-list');
    partyListDiv.innerHTML = '';
    adversaryListDiv.innerHTML = '';
    activeParty.forEach(char => {
        partyListDiv.innerHTML += `
            <div class="scene-item">
                <button class="move-button" data-id="${char.simId}" title="Return to Pool">&lt;</button>
                <span class="agent-name">${char.name} (Lvl ${char.level})</span>
            </div>`;
    });
    activeAdversaries.forEach(adv => {
        adversaryListDiv.innerHTML += `
            <div class="scene-item">
                <button class="move-button" data-id="${adv.simId}" title="Return to Pool">&lt;</button>
                <span class="agent-name">${adv.name} (Diff ${adv.difficulty})</span>
            </div>`;
    });
}

// --- SRD Modal Functions ---
function openSRDModal() {
    document.getElementById('srd-modal-overlay').classList.remove('hidden');
}
function closeSRDModal() {
    document.getElementById('srd-modal-overlay').classList.add('hidden');
}

function renderSRDAdversaries() {
    const tier = document.getElementById('srd-tier-filter').value;
    const type = document.getElementById('srd-type-filter').value;
    const listDiv = document.getElementById('srd-adversary-list');
    listDiv.innerHTML = ''; 
    if (SRD_ADVERSARIES.length === 0) {
        listDiv.innerHTML = '<div class="pool-item"><span>Loading database...</span></div>';
        return;
    }
    const filteredList = SRD_ADVERSARIES.filter(adv => {
        const tierMatch = (tier === 'any' || adv.tier == tier);
        const typeMatch = (type === 'any' || adv.type === type);
        return tierMatch && typeMatch;
    });
    if (filteredList.length === 0) {
        listDiv.innerHTML = '<div class="pool-item"><span>No adversaries match filters.</span></div>';
        return;
    }
    filteredList.forEach(adv => {
        let features = adv.features.map(f => `• ${f.name} (${f.type})`).join('\n');
        listDiv.innerHTML += `
            <div class="srd-item" data-name="${adv.name}">
                <span class="agent-name" title="${features}">${adv.name} (T${adv.tier} ${adv.type})</span>
                <button class="move-button" title="Add to Adversary Pool">Add</button>
            </div>`;
    });
}

function addAdversaryFromSRD(name) {
    const advData = SRD_ADVERSARIES.find(a => a.name === name);
    if (!advData) return;
    const isDuplicate = adversaryPool.some(a => a.name === advData.name);
    if (isDuplicate) {
        logToScreen(`--- ERROR --- \n'${advData.name}' is already in the Adversary Pool.`);
        return;
    }
    const newAdversary = JSON.parse(JSON.stringify(advData));
    newAdversary.simId = `adv-master-${Date.now()}`;
    adversaryPool.push(newAdversary);
    logToScreen(`Added ${newAdversary.name} from SRD to Adversary Pool.`);
    renderPools(); 
    closeSRDModal(); 
}

// --- PARSING & INSTANTIATION FUNCTIONS ---

function instantiatePlayerAgent(data) {
    let spellcastTrait = null;
    if (data.subclass.spellcast_trait) {
        spellcastTrait = data.subclass.spellcast_trait.toLowerCase();
    }
    let max_hp = data.class.starting_hp;
    if (data.advancementsTaken && data.advancementsTaken.add_hp) {
        max_hp += data.advancementsTaken.add_hp;
    }
    let max_stress = 6; 
    if (data.advancementsTaken && data.advancementsTaken.add_stress) {
        max_stress += data.advancementsTaken.add_stress;
    }
    if (data.subclass.foundation_feature.name.includes("At Ease")) {
        max_stress += 1;
    }
    let current_hope = 2; 

    const agent = {
        id: data.simId,
        name: data.name,
        type: 'player',
        current_hp: max_hp,
        max_hp: max_hp,
        current_stress: 0, 
        max_stress: max_stress,
        current_hope: current_hope,
        max_hope: 6,
        armor_slots: data.equipment.armor ? data.equipment.armor.score : 0, 
        current_armor_slots: data.equipment.armor ? data.equipment.armor.score : 0, 
        traits: data.traits,
        spellcastTrait: spellcastTrait,
        proficiency: data.proficiency,
        evasion: data.evasion,
        thresholds: {
            major: data.majorThreshold,
            severe: data.severeThreshold
        },
        primary_weapon: data.equipment.primary,
        features: data.features,
        domainCards: data.domainCards,
        experiences: data.experiences,
        conditions: [] // For "Vulnerable", "Restrained", etc.
    };
    return agent;
}

/**
 * Instantiates an adversary agent from the new JSON structure.
 */
function instantiateAdversaryAgent(data) {
    const agent = {
        ...data, 
        id: data.simId,
        type: 'adversary',
        current_hp: data.hp, 
        max_hp: data.hp,
        current_stress: 0,
        max_stress: data.stress,
        attack: {
            ...data.attack,
            modifier: data.attack.bonus 
        },
        conditions: []
    };
    return agent;
}

// --- SPOTLIGHT SIMULATION ENGINE ---

async function runSimulation() {
    logToScreen('======================================');
    logToScreen('INITIALIZING NEW SIMULATION...');
    logToScreen('======================================');

    if (activeParty.length === 0) { logToScreen('--- ERROR --- \nAdd a player to the Active Scene.'); return; }
    if (activeAdversaries.length === 0) { logToScreen('--- ERROR --- \nAdd an adversary to the Active Scene.'); return; }

    let playerAgents, adversaryAgents;
    try {
        playerAgents = activeParty.map(instantiatePlayerAgent);
        adversaryAgents = activeAdversaries.map(instantiateAdversaryAgent);
    } catch (e) {
        logToScreen(`--- ERROR --- \nFailed to parse agent JSON. \n${e.message}`);
        console.error("Error during instantiation:", e);
        return;
    }
    
    const gameState = {
        players: playerAgents,
        adversaries: adversaryAgents,
        hope: 2 * playerAgents.length, 
        fear: 1 * playerAgents.length, 
        spotlight: 0, 
        lastPlayerSpotlight: 0 
    };

    logToScreen(`Simulation Initialized. Hope: ${gameState.hope}, Fear: ${gameState.fear}`);
    logToScreen('Instantiated Player Agents:');
    playerAgents.forEach(agent => {
        logToScreen(`- ${agent.name} (HP: ${agent.max_hp}, Stress: ${agent.max_stress}, Evasion: ${agent.evasion})`);
    });
    logToScreen('Instantiated Adversary Agents:');
    adversaryAgents.forEach(agent => {
        logToScreen(`- ${agent.name} (HP: ${agent.max_hp}, Stress: ${agent.max_stress}, Difficulty: ${agent.difficulty})`);
    });

    logToScreen('--- COMBAT BEGINS ---');
    logToScreen(`Spotlight starts on: ${gameState.players[0].name}`);

    let simulationSteps = 0; 
    while (!isCombatOver(gameState) && simulationSteps < 50) {
        let lastOutcome = '';
        if (gameState.spotlight === 'GM') {
            lastOutcome = executeGMTurn(gameState);
        } else {
            const actingPlayer = gameState.players[gameState.spotlight];
            if (actingPlayer.current_hp > 0) {
                lastOutcome = executePCTurn(actingPlayer, gameState);
                gameState.lastPlayerSpotlight = gameState.spotlight; 
            } else {
                lastOutcome = 'PC_DOWN'; 
            }
        }
        determineNextSpotlight(lastOutcome, gameState);
        await new Promise(resolve => setTimeout(resolve, 50)); 
        simulationSteps++;
    }

    logToScreen('\n======================================');
    logToScreen('SIMULATION COMPLETE');
    logToScreen('======================================');
    logToScreen('Final Party State:');
    gameState.players.forEach(p => {
        logToScreen(`- ${p.name}: ${p.current_hp} / ${p.max_hp} HP | ${p.current_stress} / ${p.max_stress} Stress`);
    });
    logToScreen('Final Adversary State:');
    gameState.adversaries.forEach(a => {
        logToScreen(`- ${a.name}: ${a.current_hp} / ${a.max_hp} HP | ${a.current_stress} / ${a.max_stress} Stress`);
    });
    logToScreen(`Final Resources: ${gameState.hope} Hope, ${gameState.fear} Fear`);
}

function determineNextSpotlight(lastOutcome, gameState) {
    logToScreen(`  Control Flow: Last outcome was [${lastOutcome}]`);
    
    switch (lastOutcome) {
        case 'CRITICAL_SUCCESS':
        case 'SUCCESS_WITH_HOPE':
        case 'PC_DOWN':
            const nextPCIndex = (gameState.lastPlayerSpotlight + 1) % gameState.players.length;
            gameState.spotlight = nextPCIndex;
            logToScreen(`  Spotlight passes to PC: ${gameState.players[nextPCIndex].name}`);
            break;
            
        case 'SUCCESS_WITH_FEAR':
        case 'FAILURE_WITH_HOPE':
        case 'FAILURE_WITH_FEAR':
            gameState.spotlight = 'GM';
            logToScreen(`  Spotlight seized by GM!`);
            break;
            
        case 'GM_TURN_COMPLETE':
            const returnPCIndex = (gameState.lastPlayerSpotlight + 1) % gameState.players.length;
            gameState.spotlight = returnPCIndex;
            logToScreen(`  Spotlight returns to PC: ${gameState.players[returnPCIndex].name}`);
            break;
        
        case 'COMBAT_OVER':
            break;
    }
}

function executePCTurn(player, gameState) {
    let targets = gameState.adversaries.filter(a => a.current_hp > 0);
    if (targets.length === 0) return 'COMBAT_OVER';
    
    // PC AI: Focus fire on the most-damaged adversary
    const target = targets.reduce((prev, curr) => (prev.current_hp < curr.current_hp) ? prev : curr);

    logToScreen(`> ${player.name}'s turn (attacking ${target.name})...`);

    // AI v2: Use the primary weapon's trait for the attack.
    const traitName = player.primary_weapon.trait.toLowerCase();
    const traitMod = player.traits[traitName];
    
    const result = executeActionRoll(target.difficulty, traitMod, 0);
    logToScreen(`  Roll: ${traitName} (${traitMod}) | Total ${result.total} vs Diff ${result.difficulty} (${result.outcome})`);

    processRollResources(result, gameState, player);

    if (result.outcome === 'CRITICAL_SUCCESS' || result.outcome === 'SUCCESS_WITH_HOPE' || result.outcome === 'SUCCESS_WITH_FEAR') {
        let damageString = player.primary_weapon?.damage || "1d4";
        let proficiency = player.proficiency;
        let critBonus = 0; 

        if (result.outcome === 'CRITICAL_SUCCESS') {
            logToScreen('  CRITICAL HIT!');
            critBonus = parseDiceString(damageString).maxDie; 
        }

        const damageTotal = rollDamage(damageString, proficiency, critBonus); 
        applyDamage(damageTotal, player, target); 
    }
    
    return result.outcome; 
}

/**
 * --- UPDATED: GM AI v3.0 (The "True AI" Brain) ---
 * This function now reads the `parsed_effect` object
 * and executes its logic instead of using "band-aids".
 */
function executeGMTurn(gameState) {
    // 1. Find a random living adversary to act
    const livingAdversaries = gameState.adversaries.filter(a => a.current_hp > 0);
    if (livingAdversaries.length === 0) return 'COMBAT_OVER';
    const adversary = livingAdversaries[Math.floor(Math.random() * livingAdversaries.length)];
    
    // 2. Find a target (lowest HP player)
    const livingPlayers = gameState.players.filter(p => p.current_hp > 0);
    if (livingPlayers.length === 0) return 'COMBAT_OVER';
    const target = livingPlayers.reduce((prev, curr) => (prev.current_hp < curr.current_hp) ? prev : curr);

    logToScreen(`> GM SPOTLIGHT: ${adversary.name} acts (targeting ${target.name})...`);

    // 3. Find an affordable action from the `parsed_effect`
    const affordableActions = adversary.features.filter(f => {
        if (f.type !== 'action' || !f.parsed_effect) return false;
        
        // Check target conditions (e.g., "Deadly Shot" needs a "Vulnerable" target)
        const details = f.parsed_effect.actions[0].details; // Assuming first action has details
        if (details && details.target_condition) {
            if (!target.conditions.includes(details.target_condition)) {
                return false; // Can't use this action, target isn't Vulnerable
            }
        }

        if (!f.cost) return true; // Free action
        if (f.cost.type === 'stress' && (adversary.current_stress + f.cost.value <= adversary.max_stress)) return true;
        if (f.cost.type === 'fear' && (gameState.fear >= f.cost.value)) return true;
        return false;
    });

    let chosenAction = null;
    if (affordableActions.length > 0) {
        // AI v3.0: Just pick the first affordable action.
        chosenAction = affordableActions[0];
    }

    // 4. Execute the action (or default to basic attack)
    if (chosenAction) {
        logToScreen(`  Using Feature: ${chosenAction.name}!`);
        // Pay the *primary* cost
        if (chosenAction.cost) {
            if (chosenAction.cost.type === 'stress') {
                adversary.current_stress += chosenAction.cost.value;
                logToScreen(`  ${adversary.name} marks ${chosenAction.cost.value} Stress (Total: ${adversary.current_stress})`);
            } else if (chosenAction.cost.type === 'fear') {
                gameState.fear -= chosenAction.cost.value;
                logToScreen(`  GM spends ${chosenAction.cost.value} Fear (Total: ${gameState.fear})`);
            }
        }
        
        // --- THIS IS THE NEW BRAIN ---
        // Execute every action defined in the `parsed_effect`
        for (const action of chosenAction.parsed_effect.actions) {
            executeParsedEffect(action, adversary, target, gameState);
        }

    } else {
        logToScreen(`  (No affordable features found. Defaulting to basic attack.)`);
        executeGMBasicAttack(adversary, target);
    }
    
    return 'GM_TURN_COMPLETE'; 
}

/**
 * --- NEW: The "True AI" Brain ---
 * This is the central executor that reads a `parsed_effect` action
 * and makes it happen in the simulation.
 */
function executeParsedEffect(action, adversary, target, gameState) {
    let primaryTarget = target; // The default target
    let targets = [target];     // The list of all targets
    
    // 1. Determine Target(s)
    if (action.target === "ALL_IN_RANGE") {
        targets = gameState.players.filter(p => p.current_hp > 0); // TODO: Add range check
        logToScreen(`  Action targets ALL living players!`);
    }
    // ... other target types like SELF, ATTACKER, etc. can be added here
    
    // 2. Execute Action Type
    switch (action.action_type) {
        case 'ATTACK_ROLL':
            // Loop through all targets (for AOE attacks like "Spit Acid")
            for (const t of targets) {
                logToScreen(`  Making an attack roll against ${t.name}...`);
                const roll = rollD20();
                const totalAttack = roll + adversary.attack.modifier;
                logToScreen(`  Roll: 1d20(${roll}) + ${adversary.attack.modifier} = ${totalAttack} vs Evasion ${t.evasion}`);
                
                if (totalAttack >= t.evasion) {
                    logToScreen('  HIT!');
                    // Execute all on_success actions
                    if (action.details.on_success) {
                        for (const successAction of action.details.on_success) {
                            executeParsedEffect(successAction, adversary, t, gameState);
                        }
                    }
                } else {
                    logToScreen('  MISS!');
                    // TODO: Execute on_fail actions if they exist
                }
            }
            break;

        case 'FORCE_REACTION_ROLL':
            // Loop through all targets (for AOE like "Earth Eruption")
            for (const t of targets) {
                const details = action.details;
                // Find the difficulty. Your JSON has "Succeed on" for Eruption and "14" for Mockery.
                const difficulty = details.difficulty || 12; // Default diff if not specified
                logToScreen(`  ${t.name} must make a ${details.roll_type.toUpperCase()} Reaction Roll (Diff ${difficulty})!`);
                
                const reactionSuccess = executeReactionRoll(t, details.roll_type, difficulty);
                
                if (reactionSuccess) {
                    logToScreen(`  ${t.name} succeeds the Reaction Roll!`);
                    // TODO: Execute on_success actions
                } else {
                    logToScreen(`  ${t.name} fails the Reaction Roll!`);
                    // Execute all on_fail actions
                    if (details.on_fail) {
                        // This can be an array now
                        const onFailActions = Array.isArray(details.on_fail) ? details.on_fail : [details.on_fail];
                        
                        for (const failAction of onFailActions) {
                             // Recursively call this function to handle complex fail effects
                            executeParsedEffect(failAction, adversary, t, gameState);
                        }
                    }
                }
            }
            break;
            
        case 'DEAL_DAMAGE':
            let critBonus = 0; // TODO: Check for crits
            // Check for "2 stress" or "1 hp"
            let damageTotal;
            if (action.damage_string.includes("stress")) {
                const stressVal = parseInt(action.damage_string.split(' ')[0]);
                logToScreen(`  Dealing ${stressVal} DIRECT Stress!`);
                target.current_stress = Math.min(target.max_stress, target.current_stress + stressVal);
                logToScreen(`  ${target.name} Stress: ${target.current_stress} / ${target.max_stress}`);
                return; // Stop here, no HP damage
            } else if (action.damage_string.includes("hp")) {
                damageTotal = parseInt(action.damage_string.split(' ')[0]);
            } else {
                damageTotal = rollDamage(action.damage_string, 1, critBonus);
            }
            
            const isDirect = action.is_direct || false;
            if (damageTotal > 0) {
                 logToScreen(`  Dealing ${damageTotal} ${isDirect ? 'DIRECT' : ''} damage!`);
                applyDamage(damageTotal, adversary, primaryTarget, isDirect);
            } else {
                logToScreen(`  Damage roll was 0, no damage dealt.`);
            }
            break;
            
        case 'APPLY_CONDITION':
            // This is for *conditional* costs, like "Detain"
            if (action.cost) {
                if (action.cost.type === 'stress' && adversary.current_stress + action.cost.value <= adversary.max_stress) {
                    adversary.current_stress += action.cost.value;
                    logToScreen(`  ${adversary.name} marks ${action.cost.value} Stress to apply effect.`);
                    applyCondition(primaryTarget, action.condition);
                } else {
                    logToScreen(`  ${adversary.name} could not afford Stress cost to apply ${action.condition}.`);
                }
            } else {
                // This is for *unconditional* conditions, like from "Bite"
                applyCondition(primaryTarget, action.condition);
            }
            break;

        case 'GAIN_RESOURCE':
             if (action.target === 'GM' && action.details.resource === 'Fear') {
                gameState.fear += action.details.value;
                logToScreen(`  GM gains ${action.details.value} Fear (Total: ${gameState.fear})`);
             }
            break;

        // ... other action_types like SPECIAL_RULE, etc.
        
        default:
            logToScreen(`  (Logic for action_type '${action.action_type}' not yet implemented.)`);
    }
}

/**
 * --- NEW HELPER ---
 * Applies a condition to a target.
 */
function applyCondition(target, condition) {
    if (!target.conditions.includes(condition)) {
        target.conditions.push(condition);
        logToScreen(`  ${target.name} is now ${condition}!`);
        // TODO: We need to add logic for what these conditions *do*
        // e.g., if (condition === 'Vulnerable'), target.evasion -= 2;
    }
}


/**
 * Logic for the GM's basic attack.
 */
function executeGMBasicAttack(adversary, target) {
    const roll = rollD20();
    const totalAttack = roll + adversary.attack.modifier; 
    
    logToScreen(`  Roll: 1d20(${roll}) + ${adversary.attack.modifier} = ${totalAttack} vs Evasion ${target.evasion}`);

    if (totalAttack >= target.evasion) {
        logToScreen('  HIT!');
        let damageString = adversary.attack.damage;
        let critBonus = 0;

        if (roll === 20) { 
             logToScreen('  CRITICAL HIT!');
             critBonus = parseDiceString(damageString).maxDie;
        }

        const damageTotal = rollDamage(damageString, 1, critBonus); 
        applyDamage(damageTotal, adversary, target);
    } else {
        logToScreen('  MISS!');
    }
}


// --- CORE SIMULATION FUNCTIONS ---

function isCombatOver(gameState) {
    const playersAlive = gameState.players.some(p => p.current_hp > 0);
    const adversariesAlive = gameState.adversaries.some(a => a.current_hp > 0);
    
    if (!playersAlive) { logToScreen('--- All players are defeated! ---'); return true; }
    if (!adversariesAlive) { logToScreen('--- All adversaries are defeated! ---'); return true; }
    return false;
}

function processRollResources(result, gameState, player) {
    switch (result.outcome) {
        case 'CRITICAL_SUCCESS':
            gameState.hope = Math.min(player.max_hope, gameState.hope + 1); 
            player.current_stress = Math.max(0, player.current_stress - 1); 
            logToScreen(`  Resource: +1 Hope (Total: ${gameState.hope}), ${player.name} clears 1 Stress.`);
            break;
        case 'SUCCESS_WITH_HOPE':
            gameState.hope = Math.min(player.max_hope, gameState.hope + 1);
            logToScreen(`  Resource: +1 Hope (Total: ${gameState.hope})`);
            break;
        case 'FAILURE_WITH_HOPE':
            gameState.hope = Math.min(player.max_hope, gameState.hope + 1);
            logToScreen(`  Resource: +1 Hope (Total: ${gameState.hope})`);
            break;
        case 'SUCCESS_WITH_FEAR':
            gameState.fear++;
            logToScreen(`  Resource: +1 Fear (Total: ${gameState.fear})`);
            break;
        case 'FAILURE_WITH_FEAR':
            gameState.fear++;
            logToScreen(`  Resource: +1 Fear (Total: ${gameState.fear})`);
            break;
    }
}

/**
 * Applies damage to a target and logs the result.
 */
function applyDamage(damageTotal, attacker, target, isDirectDamage = false) {
    let hpToMark = 0;
    
    // 1. Determine base HP to mark from thresholds
    if (damageTotal >= target.thresholds.severe) hpToMark = 3;
    else if (damageTotal >= target.thresholds.major) hpToMark = 2;
    else if (damageTotal > 0) hpToMark = 1;

    let originalHPMark = hpToMark;
    logToScreen(`  Damage: ${damageTotal} (dealt by ${attacker.name}) vs Thresholds (${target.thresholds.major}/${target.thresholds.severe})`);
    logToScreen(`  Calculated Severity: ${originalHPMark} HP`);

    // 2. Simple Player AI: Use an Armor Slot if it reduces HP marked.
    if (target.type === 'player' && target.current_armor_slots > 0 && hpToMark > 0 && !isDirectDamage) {
        target.current_armor_slots--;
        hpToMark--;
        logToScreen(`  ${target.name} marks 1 Armor Slot! (Slots left: ${target.current_armor_slots}). Severity reduced to ${hpToMark} HP.`);
    } else if (isDirectDamage && target.type === 'player') {
        logToScreen(`  This is DIRECT damage and cannot be mitigated by armor!`);
    }
    
    // 3. Apply final damage
    target.current_hp -= hpToMark;
    
    if (originalHPMark > hpToMark) {
        logToScreen(`  Final HP marked: ${hpToMark}.`);
    } else if (originalHPMark > 0) {
        logToScreen(`  Final HP marked: ${hpToMark}.`);
    }
    
    logToScreen(`  ${target.name} HP: ${target.current_hp} / ${target.max_hp}`);

    if (target.current_hp <= 0) {
        logToScreen(`  *** ${target.name} has been defeated! ***`);
    }
}

// --- CORE DICE & PARSING UTILITIES ---

function rollD20() { return Math.floor(Math.random() * 20) + 1; }
function rollD12() { return Math.floor(Math.random() * 12) + 1; }

/**
 * Executes a non-Duality, d20 Reaction Roll.
 */
function executeReactionRoll(target, trait, difficulty) {
    const roll = rollD20();
    const traitMod = target.traits[trait.toLowerCase()] || 0;
    const total = roll + traitMod;
    
    logToScreen(`  ${target.name} makes a ${trait.toUpperCase()} Reaction Roll (Difficulty ${difficulty})...`);
    logToScreen(`  Roll: 1d20(${roll}) + ${trait}(${traitMod}) = ${total}`);
    
    return total >= difficulty;
}

function executeActionRoll(difficulty, traitModifier, otherModifiers) {
    const hopeRoll = rollD12();
    const fearRoll = rollD12();
    const safeTraitModifier = typeof traitModifier === 'number' ? traitModifier : 0;
    const safeOtherModifiers = typeof otherModifiers === 'number' ? otherModifiers : 0;
    const baseSum = hopeRoll + fearRoll;
    const total = baseSum + safeTraitModifier + safeOtherModifiers;
    let outcome = '';

    if (hopeRoll === fearRoll) { outcome = 'CRITICAL_SUCCESS'; } 
    else if (total >= difficulty) { outcome = (hopeRoll > fearRoll) ? 'SUCCESS_WITH_HOPE' : 'SUCCESS_WITH_FEAR'; } 
    else { outcome = (hopeRoll > fearRoll) ? 'FAILURE_WITH_HOPE' : 'FAILURE_WITH_FEAR'; }

    return {
        hopeRoll, fearRoll, total, difficulty, outcome
    };
}

function rollDamage(damageString, proficiency, critBonus = 0) {
    const { numDice, dieType, modifier, maxDie } = parseDiceString(damageString);
    let totalDamage = 0;
    
    // PC damage dice are multiplied by proficiency
    let diceToRoll = (proficiency > 1) ? (numDice * proficiency) : numDice;
    
    if (dieType > 0) {
        for (let i = 0; i < diceToRoll; i++) {
            totalDamage += Math.floor(Math.random() * dieType) + 1;
        }
    }
    
    totalDamage += modifier;
    totalDamage += critBonus; 
    
    return totalDamage;
}

function parseDiceString(damageString = "1d4") {
    damageString = damageString.split(' ')[0]; 
    let numDice = 1, dieType = 4, modifier = 0;
    const modSplit = damageString.split('+');
    if (modSplit.length > 1) modifier = parseInt(modSplit[1]) || 0;
    const dicePart = modSplit[0];
    const dieSplit = dicePart.split('d');
    
    if (dieSplit[0] === '') { 
        numDice = 1;
        dieType = parseInt(dieSplit[1]) || 4;
    } else if (dieSplit.length > 1) { 
        numDice = parseInt(dieSplit[0]) || 1;
        dieType = parseInt(dieSplit[1]) || 4;
    } else if (!damageString.includes('d')) { 
        numDice = 0; dieType = 0;
        modifier = parseInt(dieSplit[0]) || 0;
    }

    return { numDice, dieType, modifier, maxDie: dieType };
}

function logToScreen(message) {
   const logOutput = document.getElementById('log-output');
   if (logOutput) {
       logOutput.textContent += message + '\n';
       logOutput.scrollTop = logOutput.scrollHeight; 
   }
}