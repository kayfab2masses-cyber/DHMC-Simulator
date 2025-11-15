// --- GLOBAL STATE ---
let playerPool = []; // Column 2: Player Library
let adversaryPool = []; // Column 2: Adversary Library
let activeParty = []; // Column 3: Players in the next sim
let activeAdversaries = []; // Column 3: Adversaries in the next sim
let SRD_ADVERSARIES = []; // This will hold our loaded SRD database
let PREMADE_CHARACTERS = []; // This will hold our loaded PC database

let BATCH_LOG = null; 
let tokenCache = {}; // --- NEW: For high-speed visualizer

// --- NEW: History System ---
let simHistory = []; // Stores objects: { id, logText, playbackLog: [], finalState }
// --- END NEW ---

// --- BATTLEFIELD & RANGE CONFIGS ---
const DAGGERHEART_RANGES = {
    RANGE_MELEE: 1,
    RANGE_VERY_CLOSE: 3,
    RANGE_CLOSE: 6,      // Standard "free move" distance
    RANGE_FAR: 12        // "Full Action Move" distance
};

const MAP_CONFIGS = {
    small: { MAX_X: 15, MAX_Y: 15 },
    medium: { MAX_X: 20, MAX_Y: 20 },
    large: { MAX_X: 30, MAX_Y: 30 } // Our default
};

let CURRENT_BATTLEFIELD = {
    ...DAGGERHEART_RANGES,
    ...MAP_CONFIGS.large 
};


// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Column 1 Buttons
    document.getElementById('add-character-button').addEventListener('click', addCharacterToPool);
    document.getElementById('add-adversary-button').addEventListener('click', addAdversaryToPool);

    // Main Run Button
    document.getElementById('run-button').addEventListener('click', () => runMultipleSimulations(1));
    document.getElementById('run-multiple-button').addEventListener('click', () => runMultipleSimulations(5));
    document.getElementById('run-ten-button').addEventListener('click', () => runMultipleSimulations(10));
    document.getElementById('export-log-button').addEventListener('click', exportLog);
    
    // --- NEW: Playback Button Listener ---
    const playbackButton = document.getElementById('playback-button');
    if (playbackButton) {
        playbackButton.addEventListener('click', () => {
            if (simHistory.length > 0) {
                // We'll use the most recent simulation from the history
                playBackSimulation(simHistory.length - 1);
            }
        });
    } else {
        console.error("CRITICAL: Playback button not found in index.html");
    }
    // --- END NEW ---

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

    // PC Modal Listeners
    document.getElementById('open-pc-modal').addEventListener('click', openPCModal);
    document.getElementById('close-pc-modal').addEventListener('click', closePCModal);
    document.getElementById('pc-modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'pc-modal-overlay') closePCModal();
    });
    document.getElementById('pc-catalog-list').addEventListener('click', handlePCListClick);

    // --- VISUALIZER TOGGLE (Functionality moved to Playback Button) ---
    const visualizeToggle = document.getElementById('visualize-checkbox');
    if(visualizeToggle) visualizeToggle.style.display = 'none'; // Hide the original checkbox
    // --- END VISUALIZER TOGGLE ---

    // --- CRITICAL FIX: Restore load functions to populate modals ---
    loadSRDDatabase();
    loadPCDatabase();
    // --- END CRITICAL FIX ---
    
    renderPools();
    renderActiveScene();
    initializeBattlemap(); // Initialize the empty map grid
});

// --- DATA & POOL MANAGEMENT ---
async function loadSRDDatabase() {
    try {
        const response = await fetch('data/srd_adversaries.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (Array.isArray(data)) {
            SRD_ADVERSARIES = data;
        } else {
            throw new Error("Invalid JSON structure. Expected a top-level array '[...]'");
        }

        logToScreen(`Successfully loaded ${SRD_ADVERSARIES.length} adversaries from SRD catalog.`);
        renderSRDAdversaries();
    } catch (error) {
        logToScreen(`--- FATAL ERROR --- Could not load SRD Adversary JSON: ${error.message}`);
        console.error("Failed to fetch SRD data:", error);
    }
}

async function loadPCDatabase() {
    try {
        const response = await fetch('data/premade_characters.json'); 
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json(); 
        
        if (data && Array.isArray(data.players)) {
            PREMADE_CHARACTERS = data.players;
        } else {
            throw new Error("Invalid JSON structure. Expected an object with a top-level 'players' array.");
        }

        logToScreen(`Successfully loaded ${PREMADE_CHARACTERS.length} PCs from catalog.`);
        renderPCModalList();
    } catch (error) {
        logToScreen(`--- FATAL ERROR --- Could not load Premade PC JSON: ${error.message}`);
        console.error("Failed to fetch PC data:", error);
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
    if (!target.closest('button')) return; 
    const agentItem = target.closest('.pool-item');
    if (!agentItem) return;
    const agentId = agentItem.dataset.id;
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
    if (!target.classList.contains('move-button')) return; 
    const agentItem = target.closest('.scene-item');
    if (!agentItem) return;
    
    const agentId = agentItem.dataset.id;
    if (!agentId) return;

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

function handlePCListClick(event) {
    const target = event.target.closest('.pc-item');
    if (!target) return;
    
    if (event.target.classList.contains('move-button')) {
        const pcName = target.dataset.name;
        addPlayerFromCatalog(pcName);
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
        <div class="pool-item" data-id="${char.simId}">
            <span class="agent-name">${char.name} (Lvl ${char.level})</span>
            <div class="pool-item-controls">
                <button class="flush-button" title="Remove from Pool">X</button>
                <button class="move-button" title="Add to Active Scene">&gt;</button>
            </div>
        </div>
        `;
    });

    adversaryPool.forEach(adv => {
        adversaryListDiv.innerHTML += `
        <div class="pool-item" data-id="${adv.simId}">
            <span class="agent-name">${adv.name} (Diff ${adv.difficulty})</span>
            <div class="pool-item-controls">
                <button class="flush-button" title="Remove from Pool">X</button>
                <button class="move-button" title="Add to Active Scene">&gt;</button>
            </div>
        </div>
        `;
    });
}

function renderActiveScene() {
    const partyListDiv = document.getElementById('active-party-list');
    const adversaryListDiv = document.getElementById('active-adversary-list');
    partyListDiv.innerHTML = '';
    adversaryListDiv.innerHTML = '';

    activeParty.forEach(char => {
        partyListDiv.innerHTML += `
        <div class="scene-item" data-id="${char.simId}">
            <button class="move-button" title="Return to Pool">&lt;</button>
            <span class="agent-name">${char.name} (Lvl ${char.level})</span>
        </div>
        `;
    });

    activeAdversaries.forEach(adv => {
        adversaryListDiv.innerHTML += `
        <div class="scene-item" data-id="${adv.simId}">
            <button class="move-button" title="Return to Pool">&lt;</button>
            <span class="agent-name">${adv.name} (Diff ${adv.difficulty})</span>
        </div>
        `;
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
        const typeMatch = (type === 'any' || adv.type.startsWith(type));
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
            <span class="agent-name" title="${features}">${adv.name} (T${adv.tier})</span>
            <button class="move-button" title="Add to Adversary Pool">Add</button>
        </div>
        `;
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

// --- NEW: PC Modal Functions ---
function openPCModal() {
    document.getElementById('pc-modal-overlay').classList.remove('hidden');
}

function closePCModal() {
    document.getElementById('pc-modal-overlay').classList.add('hidden');
}

function renderPCModalList() {
    const listDiv = document.getElementById('pc-catalog-list');
    listDiv.innerHTML = ''; 

    if (PREMADE_CHARACTERS.length === 0) {
        listDiv.innerHTML = '<div class="pc-item"><span>Loading database...</span></div>';
        return;
    }

    PREMADE_CHARACTERS.forEach(pc => {
        listDiv.innerHTML += `
        <div class="pc-item" data-name="${pc.name}">
            <span class="agent-name">${pc.name} (Lvl ${pc.level} ${pc.class.name})</span>
            <button class="move-button" title="Add to Player Pool">Add</button>
        </div>
        `;
    });
}

function addPlayerFromCatalog(name) {
    const pcData = PREMADE_CHARACTERS.find(p => p.name === name);
    if (!pcData) return;
    
    const isDuplicate = playerPool.some(p => p.name === pcData.name);
    if (isDuplicate) {
        logToScreen(`--- ERROR --- \n'${pcData.name}' is already in the Player Pool.`);
        return;
    }

    const newPlayer = JSON.parse(JSON.stringify(pcData));
    newPlayer.simId = `player-${Date.now()}`;
    
    playerPool.push(newPlayer);
    logToScreen(`Added ${newPlayer.name} from Catalog to Player Pool.`);
    renderPools(); 
    closePCModal(); 
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
    if (data.class.name === "Guardian" && data.subclass.foundation_feature.name.includes("At Ease")) {
        max_stress += 1;
    }
    
    let current_hope = 2;
    const agent = {
        id: data.simId,
        name: data.name,
        type: 'player',
        class: data.class.name, // Store class name
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
        conditions: [],
        position: {
            x: Math.floor(Math.random() * 3) + 1, 
            y: Math.floor(Math.random() * CURRENT_BATTLEFIELD.MAX_Y) + 1 
        },
        speed: DAGGERHEART_RANGES.RANGE_CLOSE 
    };
    return agent;
}

function instantiateAdversaryAgent(data) {
    const attackBonus = data.attack.bonus !== undefined
        ? data.attack.bonus
        : parseInt(data.attack.modifier) || 0;

    let agent = {
        ...data,
        id: data.simId,
        type: 'adversary',
        current_hp: data.hp,
        max_hp: data.hp,
        current_stress: 0,
        max_stress: data.stress,
        attack: {
            ...data.attack,
            modifier: attackBonus
        },
        conditions: [],
        passives: {}, // --- NEW: Initialize passives object ---
        position: {
            x: CURRENT_BATTLEFIELD.MAX_X - Math.floor(Math.random() * 3),
            y: Math.floor(Math.random() * CURRENT_BATTLEFIELD.MAX_Y) + 1
        },
        speed: DAGGERHEART_RANGES.RANGE_CLOSE 
    };
    applyPassiveFeatures(agent);
    return agent;
}

function applyPassiveFeatures(agent) {
    if (!agent.features) return;
    for (const feature of agent.features) {
        if (feature.type === 'passive' && feature.parsed_effect) {
            for (const action of feature.parsed_effect.actions) {
                // Generic "All Attacks are Direct" (e.g., Cave Ogre)
                if (action.action_type === 'MODIFY_DAMAGE' && action.target === 'ALL_ATTACKS' && action.details.is_direct) {
                    logToScreen(` (Passive Applied: ${agent.name} has ${feature.name}. All attacks are DIRECT.)`);
                    agent.passives.allAttacksAreDirect = true;
                }
                // Generic "Resistance"
                if (action.action_type === 'MODIFY_STAT' && action.details.stat === 'resistance') {
                    logToScreen(` (Passive Applied: ${agent.name} has ${feature.name}.)`);
                    agent.passives.resistance = action.details.value;
                }
                // --- NEW LOGIC FOR OUR 6 ADVERSARIES ---
                // "Relentless" (Acid Burrower, Construct)
                if (action.action_type === 'MODIFY_STAT' && action.details.stat === 'max_spotlights_per_turn') {
                    logToScreen(` (Passive Applied: ${agent.name} has ${feature.name}. Can be spotlighted ${action.details.value} times.)`);
                    agent.maxSpotlights = action.details.value;
                }
                // "Ramp Up" (Cave Ogre)
                if (action.action_type === 'MODIFY_ACTION' && action.details.action === 'SPOTLIGHT') {
                    logToScreen(` (Passive Applied: ${agent.name} has ${feature.name}. Spotlight cost modified.)`);
                    agent.passives.spotlightCost = action.details.cost.value;
                }
                if (action.action_type === 'MODIFY_ATTACK' && action.target === 'STANDARD_ATTACK') {
                    logToScreen(` (Passive Applied: ${agent.name} has ${feature.name}. Standard attack is modified.)`);
                    agent.passives.attackAllInRange = (action.details.new_target === 'ALL_IN_RANGE');
                }
                // "Weak Structure" (Construct)
                if (action.action_type === 'MODIFY_DAMAGE_TAKEN' && action.trigger === 'ON_TAKE_HP_PHY') {
                     logToScreen(` (Passive Applied: ${agent.name} has ${feature.name}. Takes extra HP from Physical.)`);
                     agent.passives.takeExtraPhysicalHP = action.details.increase_hp_marked;
                }
                // "Overwhelming Force" (Bear)
                if (action.action_type === 'KNOCKBACK' && action.trigger === 'ON_DEAL_HP_STANDARD_ATTACK') {
                    logToScreen(` (Passive Applied: ${agent.name} has ${feature.name}.)`);
                    agent.passives.knockbackOnHP = {
                        range: action.range // Store the knockback range
                    };
                }
                // --- END NEW LOGIC ---
            }
        }
    }
}

// --- SPOTLIGHT SIMULATION ENGINE ---
async function runMultipleSimulations(count) {
    logToScreen(`\n===== STARTING BATCH OF ${count} SIMULATION(S) =====`);
    
    // --- NEW PATCH: "Blast Mode" is now default ---
    // We will ONLY record playback data if count === 1
    const isBlastMode = true; 
    // --- END NEW PATCH ---

    // Reset log and history for the start of a batch
    simHistory = [];
    document.getElementById('playback-button').disabled = true;

    for (let i = 1; i <= count; i++) {
        logToScreen(`\n--- SIMULATION ${i} OF ${count} ---`);
        
        await runSimulation(count, isBlastMode); // Pass total count and blast status
        
        // "Breathe" to prevent freezing after a very fast synchronous run
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    logToScreen(`\n===== BATCH COMPLETE =====`);
    
    // Enable playback button if only 1 run was executed
    if (count === 1 && simHistory.length === 1 && simHistory[0].playbackLog) {
        document.getElementById('playback-button').disabled = false;
    }
}

function exportLog() {
    const logOutput = document.getElementById('log-output');
    const logContent = logOutput.textContent;
    
    const blob = new Blob([logContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dhmc_simulation_log_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    logToScreen(`\n--- Log exported! ---`);
}

// --- NEW SIGNATURE: runSimulation accepts count ---
async function runSimulation(count, isBlastMode = false) {
    // Determine if we need to record map data (Only for single runs)
    const recordPlayback = (count === 1); 
    
    if (isBlastMode) {
        BATCH_LOG = []; // Hijack the logger
    }

    logToScreen('======================================');
    logToScreen('INITIALIZING NEW SIMULATION...');
    logToScreen('======================================');

    const mapSize = document.getElementById('map-size-select').value;
    
    CURRENT_BATTLEFIELD = {
        ...DAGGERHEART_RANGES,
        ...MAP_CONFIGS[mapSize] 
    };

    logToScreen(`Simulating on ${mapSize} map (${CURRENT_BATTLEFIELD.MAX_X}x${CURRENT_BATTLEFIELD.MAX_Y})...`);

    // --- START FIX ---
    if (activeParty.length === 0) { 
        logToScreen('--- ERROR --- \nAdd a player to the Active Scene.'); 
        if (isBlastMode) {
            // We MUST dump the log before nullifying it
            const logOutput = document.getElementById('log-output');
            if (logOutput) {
                 logOutput.textContent += BATCH_LOG.join('\n') + '\n';
                 logOutput.scrollTop = logOutput.scrollHeight;
            }
            BATCH_LOG = null; // Now it's safe
        } 
        return; 
    }
    if (activeAdversaries.length === 0) { 
        logToScreen('--- ERROR --- \nAdd an adversary to the Active Scene.'); 
        if (isBlastMode) {
            // We MUST dump the log before nullifying it
            const logOutput = document.getElementById('log-output');
            if (logOutput) {
                 logOutput.textContent += BATCH_LOG.join('\n') + '\n';
                 logOutput.scrollTop = logOutput.scrollHeight;
            }
            BATCH_LOG = null; // Now it's safe
        } 
        return; 
    }
    // --- END FIX ---

    let playerAgents, adversaryAgents;
    try {
        playerAgents = activeParty.map(instantiatePlayerAgent);
        adversaryAgents = activeAdversaries.map(instantiateAdversaryAgent);
    } catch (e) {
        logToScreen(`--- ERROR --- \nFailed to parse agent JSON. \n${e.message}`);
        console.error("Error during instantiation:", e);
        if (isBlastMode) { BATCH_LOG = null; } 
        return; 
    }

    let currentPlaybackLog = []; // Local array for map snapshots
    const startTime = Date.now(); // Start timer for stats

    const gameState = {
        players: playerAgents,
        adversaries: adversaryAgents,
        hope: 2 * playerAgents.length,
        fear: 1 * playerAgents.length,
        spotlight: 0,
        lastPlayerSpotlight: 0
    };

    logToScreen(`Simulation Initialized. Hope: ${gameState.hope}, Fear: ${gameState.fear}`);
    // Log initial state setup (not full details, just summary)

    // --- SYNCHRONOUS SIMULATION LOOP ---
    while (!isCombatOver(gameState)) {
        let lastOutcome = '';
        
        // Record snapshot before the turn starts
        if (recordPlayback) {
            recordSnapshot(gameState, currentPlaybackLog);
        }

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
        
        if (isCombatOver(gameState)) {
            break;
        }
    }
    // --- END SYNCHRONOUS SIMULATION LOOP ---

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // --- FINAL LOG DUMP & HISTORY SAVE ---
    if (recordPlayback) {
        // Record final snapshot
        recordSnapshot(gameState, currentPlaybackLog);
    }

    const finalLogText = BATCH_LOG ? BATCH_LOG.join('\n') : `(No detailed log recorded for batch run, duration: ${duration}s)`;
    
    // Save final results to history
    simHistory.push({
        id: simHistory.length + 1,
        duration: duration,
        logText: finalLogText,
        players: gameState.players.map(p => ({ name: p.name, hp: p.current_hp, stress: p.current_stress })),
        adversaries: gameState.adversaries.map(a => ({ name: a.name, hp: a.current_hp, stress: a.current_stress })),
        playbackLog: currentPlaybackLog.length > 0 ? currentPlaybackLog : null
    });
    
    // Dump results if in blast mode (or this is the final sim in a long run)
    if (isBlastMode) {
        const logOutput = document.getElementById('log-output');
        if (logOutput) {
             // For batches > 1, we still want the summary to appear instantly
             logOutput.textContent += finalLogText + '\n';
             logOutput.scrollTop = logOutput.scrollHeight;
        }
        BATCH_LOG = null; // Release the hijack
    }
}

// --- NEW FUNCTION: RECORDS STATE SNAPSHOT ---
function recordSnapshot(gameState, playbackLog) {
    // Deep copy current state for the playback 'tape'
    const snapshot = {
        players: gameState.players.map(p => ({
            id: p.id,
            name: p.name,
            current_hp: p.current_hp,
            position: { ...p.position }
        })),
        adversaries: gameState.adversaries.map(a => ({
            id: a.id,
            name: a.name,
            current_hp: a.current_hp,
            position: { ...a.position }
        }))
    };
    playbackLog.push(snapshot);
}

// --- NEW FUNCTION: PLAYS BACK SAVED SIMULATION ---
async function playBackSimulation(historyIndex) {
    const simData = simHistory[historyIndex];
    if (!simData || !simData.playbackLog) {
        alert("No visual playback data found for this simulation.");
        return;
    }
    
    const mapContainer = document.getElementById('visualizer-container');
    const logContainer = document.getElementById('log-container');
    
    // 1. Prepare UI for playback
    mapContainer.classList.remove('hidden');
    logContainer.classList.remove('full-width');
    
    logToScreen(`\n\n=== STARTING REPLAY OF SIMULATION #${simData.id} ===`);

    // 2. Clear old state and set up for playback
    const map = document.getElementById('battlemap-grid');
    map.innerHTML = '';
    tokenCache = {}; // Reset token cache for replay
    
    // Use the coordinates from the first frame to initialize the map and create tokens
    const initialState = simData.playbackLog[0];

    map.style.gridTemplateColumns = `repeat(${CURRENT_BATTLEFIELD.MAX_X}, 1fr)`;
    map.style.gridTemplateRows = `repeat(${CURRENT_BATTLEFIELD.MAX_Y}, 1fr)`;

    let gridHtml = '';
    const totalCells = CURRENT_BATTLEFIELD.MAX_X * CURRENT_BATTLEFIELD.MAX_Y;
    for (let i = 0; i < totalCells; i++) {
        gridHtml += '<div class="empty-cell"></div>';
    }
    map.innerHTML = gridHtml;

    // Create tokens based on initial state
    const allAgents = [...initialState.players, ...initialState.adversaries];
    for (const agent of allAgents) {
        const token = document.createElement('div');
        token.className = agent.id.startsWith('player') ? 'token player-token' : 'token adversary-token';
        token.id = agent.id;
        map.appendChild(token);
        tokenCache[agent.id] = token;
    }
    
    // 3. Play back the frames
    for (let i = 0; i < simData.playbackLog.length; i++) {
        const snapshot = simData.playbackLog[i];
        
        // This is a simplified render function that only uses the snapshot data
        for (const agent of [...snapshot.players, ...snapshot.adversaries]) {
            const token = tokenCache[agent.id];
            if (!token) continue;
            
            if (agent.current_hp <= 0) {
                token.style.display = 'none';
            } else {
                token.style.display = 'block';
                token.title = `${agent.name} (HP: ${agent.current_hp})`;
                token.style.gridColumn = agent.position.x;
                token.style.gridRow = agent.position.y;
            }
        }
        
        // Pause for playback speed
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    logToScreen(`=== REPLAY COMPLETE. Duration: ${simData.duration.toFixed(2)}s ===`);
}


function findNextLivingPC(gameState) {
    const { players, lastPlayerSpotlight } = gameState;
    let nextIndex = (lastPlayerSpotlight + 1) % players.length;
    
    for (let i = 0; i < players.length; i++) {
        if (players[nextIndex].current_hp > 0) {
            return nextIndex; 
        }
        nextIndex = (nextIndex + 1) % players.length;
    }
    
    return -1;
}

function determineNextSpotlight(lastOutcome, gameState) {
    logToScreen(` Control Flow: Last outcome was [${lastOutcome}]`);
    
    if (isCombatOver(gameState)) {
        logToScreen(` --- Combat is Over ---`);
        return; 
    }

    let nextPCIndex;
    switch (lastOutcome) {
        case 'CRITICAL_SUCCESS':
        case 'PC_DOWN':
            nextPCIndex = findNextLivingPC(gameState);
            if (nextPCIndex === -1) return; 
            gameState.spotlight = nextPCIndex;
            logToScreen(` Spotlight passes to PC: ${gameState.players[nextPCIndex].name}`);
            break;
            
        case 'SUCCESS_WITH_HOPE':
            if (gameState.fear > 0 && Math.random() < 0.5) { 
                logToScreen(`PC succeeded with Hope, but GM spends 1 Fear to seize the spotlight!`);
                gameState.fear = Math.max(0, gameState.fear - 1);
                logToScreen(` GM Fear: ${gameState.fear}`);
                gameState.spotlight = 'GM';
            } else {
                nextPCIndex = findNextLivingPC(gameState);
                if (nextPCIndex === -1) return; 
                gameState.spotlight = nextPCIndex;
                logToScreen(` Spotlight passes to PC: ${gameState.players[nextPCIndex].name}`);
            }
            break;

        case 'SUCCESS_WITH_FEAR':
        case 'FAILURE_WITH_HOPE': 
        case 'FAILURE_WITH_FEAR':
            gameState.spotlight = 'GM';
            logToScreen(` Spotlight seized by GM!`);
            break;

        case 'GM_TURN_COMPLETE':
            nextPCIndex = findNextLivingPC(gameState);
            if (nextPCIndex === -1) return; 
            gameState.spotlight = nextPCIndex;
            logToScreen(` Spotlight returns to PC: ${gameState.players[nextPCIndex].name}`);
            break;
            
        case 'COMBAT_OVER':
            break;
    }
}

// --- *** NEW: v2.0 PC "SMART" BRAIN *** ---
function executePCTurn(player, gameState) {
    let targets = gameState.adversaries.filter(a => a.current_hp > 0);
    if (targets.length === 0) return 'COMBAT_OVER';
    
    // 1. Find the closest, living adversary
    const target = targets.sort((a, b) => {
        let distA = getAgentDistance(player, a);
        let distB = getAgentDistance(player, b);
        return distA - distB;
    })[0];

    logToScreen(`> ${player.name}'s turn (targeting ${target.name} at (${target.position.x}, ${target.position.y}))...`);

    // 2. Ask the "Smart Brain" what to do
    const chosenAction = choosePCAction(player, target, gameState);
    let result;

    // 3. Execute the chosen action
    if (chosenAction) {
        switch (chosenAction.type) {
            case 'SPELL':
                result = executePCSpell(player, chosenAction.card, target, gameState);
                break;
            case 'ATTACK':
                result = executePCBasicAttack(player, target, gameState);
                break;
            default:
                logToScreen(`(ERROR: Unknown action type: ${chosenAction.type})`);
                result = { outcome: 'FAILURE_WITH_FEAR' }; // Failsafe
        }
    } else {
        // 4. If no action was chosen, the only option is to move
        logToScreen(` -> ${target.name} is out of range of all options. Moving closer.`);
        moveAgentTowards(player, target, gameState); 
        
        logToScreen(` -> Making Agility roll to move...`);
        result = executeActionRoll(10, player.traits.agility || 0, 0); 
        logToScreen(` Roll: agility (0) | Total ${result.total} vs Diff 10 (${result.outcome})`);
    }
    
    processRollResources(result, gameState, player);
    return result.outcome;
}

/**
 * --- *** NEW: v2.0 PC "DECISION" BRAIN *** ---
 * This is the "brain" that decides WHAT to do.
 * @returns {object|null} The best action object, or null if no action is possible (must move).
 */
function choosePCAction(player, target, gameState) {
    let possibleActions = [];

    // 1. Check Domain Cards
    for (const card of player.domainCards) {
        switch (card.name) {
            case "Vicious Entangle": // Ranger
                if (isTargetInRange(player, target, "Far")) {
                    possibleActions.push({ type: 'SPELL', card: card, priority: 1, name: "Vicious Entangle" });
                }
                break;
            case "Bolt Beacon": // Wizard
                if (player.current_hope >= 1 && isTargetInRange(player, target, "Far")) {
                    possibleActions.push({ type: 'SPELL', card: card, priority: 1, name: "Bolt Beacon" });
                }
                break;
            case "Book Of Illiat": // Bard / Wizard
                // AI will try to use "Slumber"
                if (isTargetInRange(player, target, "Very Close")) {
                    possibleActions.push({ type: 'SPELL', card: card, priority: 2, name: "Slumber" });
                }
                break;
            // TODO: Add more 'case' statements here for other cards
        }
    }

    // 2. Check Basic Attack
    const weaponRange = player.primary_weapon.range;
    if (isTargetInRange(player, target, weaponRange)) {
        possibleActions.push({ type: 'ATTACK', priority: 0, name: `Basic Attack (${player.primary_weapon.name})` });
    }

    // 3. Decide which action to take
    if (possibleActions.length === 0) {
        return null; // No actions possible, must move
    }

    // Sort by priority (highest number wins)
    possibleActions.sort((a, b) => b.priority - a.priority);
    
    logToScreen(` -> ${player.name} considered: [${possibleActions.map(a => a.name).join(', ')}]`);
    
    // For now, AI is simple and just picks the highest priority (first) action
    const bestAction = possibleActions[0];
    logToScreen(` -> Decided on: ${bestAction.name}`);
    return bestAction;
}

/**
 * --- *** NEW: PC "ACTION LEXICON" (Attack) *** ---
 * Executes a standard primary weapon attack.
 */
function executePCBasicAttack(player, target, gameState) {
    logToScreen(` -> Attacking with ${player.primary_weapon.name}!`);
    const traitName = player.primary_weapon.trait.toLowerCase();
    const traitMod = player.traits[traitName];
    
    const result = executeActionRoll(target.difficulty, traitMod, 0);
    logToScreen(` Roll: ${traitName} (${traitMod}) | Total ${result.total} vs Diff ${target.difficulty} (${result.outcome})`);
    
    if (result.outcome === 'CRITICAL_SUCCESS' || result.outcome === 'SUCCESS_WITH_HOPE' || result.outcome === 'SUCCESS_WITH_FEAR') {
        let damageString = player.primary_weapon?.damage || "1d4";
        let proficiency = player.proficiency;
        let critBonus = 0; 
        
        if (result.outcome === 'CRITICAL_SUCCESS') {
            logToScreen(' CRITICAL HIT!');
            critBonus = parseDiceString(damageString).maxDie; 
        }

        // --- BUGFIX: Removed call to checkAdversaryReactions. ---
        const damageTotal = rollDamage(damageString, proficiency, critBonus); 
        
        const damageInfo = { 
            amount: damageTotal, 
            isDirect: false, 
            isPhysical: (damageString.includes('phy')),
            isStandardAttack: true
        };
        applyDamage(damageInfo, player, target, gameState);
    }
    return result;
}

/**
 * --- *** NEW: PC "ACTION LEXICON" (Spells) *** ---
 * Executes a spell from a Domain Card.
 */
function executePCSpell(player, card, target, gameState) {
    const traitMod = player.traits[player.spellcastTrait];
    let result;

    switch (card.name) {
        case "Vicious Entangle":
            logToScreen(` -> Casting "Vicious Entangle" on ${target.name}!`);
            result = executeActionRoll(target.difficulty, traitMod, 0);
            logToScreen(` Roll: ${player.spellcastTrait} (${traitMod}) | Total ${result.total} vs Diff ${target.difficulty} (${result.outcome})`);
            
            if (result.outcome === 'CRITICAL_SUCCESS' || result.outcome === 'SUCCESS_WITH_HOPE' || result.outcome === 'SUCCESS_WITH_FEAR') {
                const damageTotal = rollDamage("1d8+1", 1, 0); // 1d8+1 phy
                const damageInfo = { amount: damageTotal, isDirect: false, isPhysical: true, isStandardAttack: false };
                applyDamage(damageInfo, player, target, gameState);
                applyCondition(target, "Restrained");
            }
            break;

        case "Bolt Beacon":
            logToScreen(` -> Casting "Bolt Beacon" on ${target.name}!`);
            if (player.current_hope < 1) {
                logToScreen(` -> Not enough Hope to cast! (Cost: 1)`);
                return { outcome: 'FAILURE_WITH_FEAR' }; // Failed action
            }
            player.current_hope--; // Pay cost
            logToScreen(` -> Spent 1 Hope (Total: ${player.current_hope})`);
            
            result = executeActionRoll(target.difficulty, traitMod, 0);
            logToScreen(` Roll: ${player.spellcastTrait} (${traitMod}) | Total ${result.total} vs Diff ${target.difficulty} (${result.outcome})`);
            
            if (result.outcome === 'CRITICAL_SUCCESS' || result.outcome === 'SUCCESS_WITH_HOPE' || result.outcome === 'SUCCESS_WITH_FEAR') {
                const damageTotal = rollDamage("1d8+2", player.proficiency, 0); // d8+2 magic, uses proficiency
                const damageInfo = { amount: damageTotal, isDirect: false, isPhysical: false, isStandardAttack: false };
                applyDamage(damageInfo, player, target, gameState);
                applyCondition(target, "Vulnerable");
            }
            break;

        case "Book Of Illiat":
            // AI is using "Slumber"
            logToScreen(` -> Casting "Slumber" (from Book of Illiat) on ${target.name}!`);
            result = executeActionRoll(target.difficulty, traitMod, 0);
            logToScreen(` Roll: ${player.spellcastTrait} (${traitMod}) | Total ${result.total} vs Diff ${target.difficulty} (${result.outcome})`);

            if (result.outcome === 'CRITICAL_SUCCESS' || result.outcome === 'SUCCESS_WITH_HOPE' || result.outcome === 'SUCCESS_WITH_FEAR') {
                applyCondition(target, "Asleep");
            }
            break;
        
        default:
            logToScreen(`(ERROR: AI does not know how to cast spell: ${card.name})`);
            return { outcome: 'FAILURE_WITH_FEAR' }; // Failsafe
    }

    return result;
}


function executeGMTurn(gameState) {
    logToScreen(`> GM SPOTLIGHT:`);
    
    let adversaryToAct = getAdversaryToAct(gameState);
    if (adversaryToAct) {
        performAdversaryAction(adversaryToAct.adversary, adversaryToAct.target, gameState);
    } else {
        logToScreen(` (No living adversaries or players left.)`);
        return 'COMBAT_OVER'; 
    }

    let spotlightedAdversaries = [adversaryToAct.adversary.id]; 
    while (gameState.fear > 0 && !isCombatOver(gameState)) {
        // TODO: This is the "dumb" coin-flip logic we need to upgrade
        if (Math.random() < 0.5) { 
            logToScreen(` GM decides to spend Fear for an *additional* spotlight...`);

            // --- NEW PATCH: Check for Spotlight Cost (Cave Ogre) ---
            let spotlightCost = 1; // Default cost
            const potentialNextAdversary = getAdversaryToAct(gameState, spotlightedAdversaries);
            if (potentialNextAdversary && potentialNextAdversary.adversary.passives.spotlightCost) {
                spotlightCost = potentialNextAdversary.adversary.passives.spotlightCost;
                logToScreen(` (${potentialNextAdversary.adversary.name}'s 'Ramp Up' makes this cost ${spotlightCost} Fear!)`);
            }

            if (gameState.fear < spotlightCost) {
                logToScreen(` (GM lacks the ${spotlightCost} Fear to continue.)`);
                break; // Break the loop
            }
            // --- END PATCH ---
            
            gameState.fear -= spotlightCost; // Use the variable cost
            logToScreen(` GM Fear: ${gameState.fear}`);
            
            let additionalAdversary = getAdversaryToAct(gameState, spotlightedAdversaries);
            if (additionalAdversary) {
                spotlightedAdversaries.push(additionalAdversary.adversary.id);
                performAdversaryAction(additionalAdversary.adversary, additionalAdversary.target, gameState);
            } else {
                logToScreen(` (No more available adversaries to act.)`);
                break; // Break the loop
            }
        } else {
            logToScreen(` GM chooses to hold their Fear and pass the spotlight.`);
            break; 
        }
    }
    
    return 'GM_TURN_COMPLETE'; 
}

function getAdversaryToAct(gameState, actedThisTurn = []) {
    const livingPlayers = gameState.players.filter(p => p.current_hp > 0);
    if (livingPlayers.length === 0) return null; 

    let livingAdversaries = gameState.adversaries.filter(a => a.current_hp > 0);
    if (livingAdversaries.length === 0) return null; 

    // --- NEW PATCH: Respect "Relentless" ---
    let availableAdversaries = livingAdversaries.filter(a => {
        if (actedThisTurn.includes(a.id)) {
            const max = a.maxSpotlights || 1;
            const acted = actedThisTurn.filter(id => id === a.id).length;
            return acted < max; // Can act again if not at max
        }
        return true; // Hasn't acted, is available
    });

    if (availableAdversaries.length === 0) {
        logToScreen(` (All available adversaries have acted their max times this turn.)`);
        return null; // This will gracefully end the GM turn
    }
    // --- END PATCH ---

    let adversary;
    // --- NEW: Prioritize agents who haven't acted ---
    let whoHaventActed = availableAdversaries.filter(a => !actedThisTurn.includes(a.id));
    if (whoHaventActed.length > 0) {
        adversary = whoHaventActed[Math.floor(Math.random() * whoHaventActed.length)];
    } else {
        // This means we're picking for a Relentless action
        adversary = availableAdversaries[Math.floor(Math.random() * availableAdversaries.length)];
    }
    // --- END NEW ---

    const target = livingPlayers.sort((a, b) => {
        let distA = getAgentDistance(adversary, a);
        let distB = getAgentDistance(adversary, b);
        return distA - distB;
    })[0];

    return { adversary, target };
}

function performAdversaryAction(adversary, target, gameState) {
    logToScreen(` Spotlight is on: ${adversary.name} (targeting ${target.name} at (${target.position.x}, ${target.position.y}))...`);

    const allActions = adversary.features.filter(f => f.type === 'action' && f.parsed_effect);

    const affordableAndInRangeActions = allActions.filter(f => {
        if (f.cost) {
            if (f.cost.type === 'stress' && (adversary.current_stress + f.cost.value > adversary.max_stress)) {
                return false; 
            }
            if (f.cost.type === 'fear' && (gameState.fear < f.cost.value)) {
                return false; 
            }
        }
        
        const firstEffect = f.parsed_effect.actions[0];
        const range = (firstEffect && firstEffect.range) ? firstEffect.range : 'Melee';

        if (range.toLowerCase() === "self") return true; 

        if (!isTargetInRange(adversary, target, range)) {
            logToScreen(` (Skipping ${f.name}: Target is out of ${range} range.)`);
            return false; 
        }
        
        if (firstEffect.details) {
            if (firstEffect.details.target_condition && !target.conditions.includes(firstEffect.details.target_condition)) {
                logToScreen(` (Skipping ${f.name}: Target is not ${firstEffect.details.target_condition})`);
                return false; 
            }
        }
        return true; 
    });

    // --- NEW PRIORITY LOGIC ---
    let chosenAction = null;
    if (affordableAndInRangeActions.length > 0) {
        // Simple AI: Prioritize actions that cost Fear, then Stress, then free ones
        affordableAndInRangeActions.sort((a, b) => {
            let priorityA = 0;
            let priorityB = 0;

            if (a.cost?.type === 'fear') priorityA = 3;
            else if (a.cost?.type === 'stress') priorityA = 2;
            else priorityA = 1;

            if (b.cost?.type === 'fear') priorityB = 3;
            else if (b.cost?.type === 'stress') priorityB = 2;
            else priorityB = 1;
            
            // TODO: Add more priority, e.g., for multi-target actions
            // const firstActionA = a.parsed_effect.actions[0];
            // if (firstActionA.target === "ALL_IN_RANGE") priorityA += 2;

            return priorityB - priorityA; // Sort high-to-low
        });

        chosenAction = affordableAndInRangeActions[0]; // Pick the highest priority action
    }
    // --- END OF NEW LOGIC ---

    if (chosenAction) {
        logToScreen(` -> Using Feature: ${chosenAction.name}!`);
        if (chosenAction.cost) {
            if (chosenAction.cost.type === 'stress') {
                adversary.current_stress += chosenAction.cost.value;
                logToScreen(` ${adversary.name} marks ${chosenAction.cost.value} Stress (Total: ${adversary.current_stress})`);
            } else if (chosenAction.cost.type === 'fear') {
                gameState.fear -= chosenAction.cost.value;
                logToScreen(` GM spends ${chosenAction.cost.value} Fear for the feature (Total: ${gameState.fear})`);
            }
        }
        
        for (const action of chosenAction.parsed_effect.actions) {
            executeParsedEffect(action, adversary, target, gameState);
        }
    } else {
        const weaponRange = adversary.attack.range || 'Melee';
        if (isTargetInRange(adversary, target, weaponRange)) {
            logToScreen(` -> No features available. Target is in ${weaponRange} range. Defaulting to basic attack.`);
            executeGMBasicAttack(adversary, target, gameState); // Pass gameState
        } else {
            // TODO: This is where we will add the "Smarter Far Move" logic
            logToScreen(` -> No features available. Target is out of ${weaponRange} range.`);
            moveAgentTowards(adversary, target, gameState); // Pass gameState
        }
    }
}

// --- NEW: ADVERSARY BRAIN LEXICON ---
function executeParsedEffect(action, adversary, target, gameState) {
    let primaryTarget = target; 
    let targets = [target]; 

    // Target validation
    if (action.target === "ALL_IN_RANGE" || action.target === "ALL_IN_RANGE_FRONT" || action.target === "ALL_AFFECTED") {
        const actionRange = action.range || 'Very Close';
        targets = gameState.players.filter(p => p.current_hp > 0 && isTargetInRange(adversary, p, actionRange));
        logToScreen(` -> Action targets ${targets.length} players in ${actionRange} range!`);
        if (targets.length === 0) {
            logToScreen(` -> No players in range. Action fails.`);
            return;
        }
        primaryTarget = targets[0]; // Set a default primary target for simplicity
    }

    switch (action.action_type) {
        case 'ATTACK_ROLL':
            // --- NEW: Handle top-level Fear Cost (Deeproot Defender) ---
            if (action.details.cost) {
                if (action.details.cost.type === 'fear') {
                    if (gameState.fear >= action.details.cost.value) {
                        gameState.fear -= action.details.cost.value;
                        logToScreen(` -> GM spends ${action.details.cost.value} Fear for the action (Total: ${gameState.fear})`);
                    } else {
                        logToScreen(` -> GM cannot afford Fear cost for ${action.name}. Action fails.`);
                        return; // Abort the entire action
                    }
                }
            }
            // --- END NEW ---

            let hitCount = 0; 
            for (const t of targets) {
                logToScreen(` Making an attack roll against ${t.name}...`);
                
                // --- NEW: Check for "Before Damage" reactions (e.g., Construct's Overload) ---
                let damageBonus = 0;
                let takeSpotlight = false;
                const reactionResult = checkAdversaryReactions("BEFORE_DEALING_DAMAGE", adversary, t, gameState);
                if (reactionResult.damageBonus) {
                    damageBonus = reactionResult.damageBonus;
                }
                if (reactionResult.takeSpotlight) {
                    takeSpotlight = true;
                }
                // --- END NEW ---
                
                const roll = rollD20();
                const modifier = adversary.attack.modifier || 0;
                const totalAttack = roll + modifier;
                logToScreen(` Roll: 1d20(${roll}) + ${modifier} = ${totalAttack} vs Evasion ${t.evasion}`);
                
                if (totalAttack >= t.evasion) {
                    logToScreen(' HIT!');
                    hitCount++; 

                    // --- NEW: Handle "attack_type": "standard" (Bear's Bite) ---
                    if (action.details.attack_type === 'standard') {
                        logToScreen(` -> This is a STANDARD attack type.`);
                        const damageString = adversary.attack.damage;
                        const damageTotal = rollDamage(damageString, 1, 0) + damageBonus;
                        const isDirect = adversary.passives.allAttacksAreDirect || false;
                        const damageInfo = { 
                            amount: damageTotal, 
                            isDirect: isDirect, 
                            isPhysical: (adversary.attack.damage.includes('phy')),
                            isStandardAttack: true
                        };
                        applyDamage(damageInfo, adversary, t, gameState);
                        
                        checkAdversaryReactions("ON_SUCCESSFUL_ATTACK", adversary, t, gameState, damageInfo);
                    }
                    // --- END NEW ---

                    if (action.details.on_success) {
                        for (const successAction of action.details.on_success) {
                            // Apply damage bonus if it exists
                            if (successAction.action_type === 'DEAL_DAMAGE' && damageBonus > 0) {
                                successAction.bonus = damageBonus; // Add bonus to the action
                            }
                            executeParsedEffect(successAction, adversary, t, gameState);
                        }
                    }
                } else {
                    logToScreen(' MISS!');
                    if (action.details.on_fail) {
                        const onFailActions = Array.isArray(action.details.on_fail) ? action.details.on_fail : [action.details.on_fail];
                        for (const failAction of onFailActions) {
                            executeParsedEffect(failAction, adversary, t, gameState);
                        }
                    }
                }

                if (takeSpotlight) {
                    logToScreen(` -> ${adversary.name} takes the spotlight again! (Logic not implemented)`);
                }
            }
            
            // --- ACID BURROWER BUG FIX ---
            // Handle multi-target success
            if (action.details.on_success_multi_target && hitCount >= 2) {
                // This bypasses the flawed JSON data and follows the user's text.
                if (adversary.name === "Acid Burrower" && action.details.on_success[1]?.action_type === "FORCE_MARK_ARMOR_SLOT") {
                    logToScreen(` -> (Ignoring flawed JSON multi-target 'Fear' gain)`);
                } else {
                // --- END FIX ---
                    logToScreen(` -> Hit ${hitCount} targets, triggering multi-target effect!`);
                    executeParsedEffect(action.details.on_success_multi_target, adversary, target, gameState);
                }
            }
            break;

        case 'FORCE_REACTION_ROLL':
            for (const t of targets) {
                const details = action.details;
                const difficulty = details.difficulty || 12; 
                logToScreen(` ${t.name} must make a ${details.roll_type.toUpperCase()} Reaction Roll (Diff ${difficulty})...`);
                
                const reactionSuccess = executeReactionRoll(t, details.roll_type, difficulty);
                
                if (reactionSuccess) {
                    logToScreen(` ${t.name} succeeds the Reaction Roll!`);
                    if (details.on_success) {
                        const onSuccessActions = Array.isArray(details.on_success) ? details.on_success : [details.on_success];
                        for (const successAction of onSuccessActions) {
                            executeParsedEffect(successAction, adversary, t, gameState);
                        }
                    }
                } else {
                    logToScreen(` ${t.name} fails the Reaction Roll!`);
                    if (details.on_fail) {
                        const onFailActions = Array.isArray(details.on_fail) ? details.on_fail : [details.on_fail];
                        for (const failAction of onFailActions) {
                            executeParsedEffect(failAction, adversary, t, gameState);
                        }
                    }
                }
            }
            break;

        case 'DEAL_DAMAGE':
            // Check for costs (like from Bear's "Bite")
            if (action.cost) {
                if (action.cost.type === 'fear' && gameState.fear >= action.cost.value) {
                    gameState.fear -= action.cost.value;
                    logToScreen(` -> GM spends ${action.cost.value} Fear for the effect (Total: ${gameState.fear})`);
                } else if (action.cost.type === 'fear') {
                    logToScreen(` -> GM cannot afford Fear cost for damage. Aborting effect.`);
                    return; // Stop this effect
                }
            }

            let critBonus = 0; 
            let damageTotal;

            if (action.damage_string === 'half') {
                logToScreen(` (Logic Error: 'half' damage is not yet implemented. Dealing 1 damage.)`);
                damageTotal = 1; 
            } else if (action.damage_string.includes("stress") || action.damage_string.includes("HP")) {
                const parts = action.damage_string.split(' ');
                const value = parseInt(parts[0]) || 1;
                if (parts[1].toLowerCase() === 'stress') {
                    logToScreen(` Dealing ${value} DIRECT Stress!`);
                    target.current_stress = Math.min(target.max_stress, target.current_stress + value);
                    logToScreen(` ${target.name} Stress: ${target.current_stress} / ${target.max_stress}`);
                    return; 
                } else { 
                    damageTotal = value;
                }
            } else {
                damageTotal = rollDamage(action.damage_string, 1, critBonus);
            }
            
            // Add bonus from reactions (Construct's Overload)
            if (action.bonus) {
                logToScreen(` -> Adding ${action.bonus} damage from Overload!`);
                damageTotal += action.bonus;
            }

            // Fix for Acid Bath (is NOT direct)
            const isDirect = (action.is_direct && action.damage_string !== "1d10 phy" && action.damage_string !== "1d6 phy") || adversary.passives.allAttacksAreDirect || false;
            
            if (damageTotal > 0) {
                logToScreen(` Dealing ${damageTotal} ${isDirect ? 'DIRECT' : ''} damage!`);
                const damageInfo = {
                    amount: damageTotal,
                    isDirect: isDirect,
                    isPhysical: (action.damage_string.includes('phy')),
                    isStandardAttack: false
                };
                applyDamage(damageInfo, adversary, primaryTarget, gameState); 
            } else {
                logToScreen(` Damage roll was 0, no damage dealt.`);
            }
            break;

        case 'DEAL_STRESS': 
            const stressVal = action.value || 0;
            if (stressVal > 0) {
                logToScreen(` Dealing ${stressVal} DIRECT Stress!`);
                target.current_stress = Math.min(target.max_stress, target.current_stress + stressVal);
                logToScreen(` ${target.name} Stress: ${target.current_stress} / ${target.max_stress}`);
            }
            break;

        case 'APPLY_CONDITION':
            if (action.cost) {
                if (action.cost.type === 'stress' && adversary.current_stress + action.cost.value <= adversary.max_stress) {
                    adversary.current_stress += action.cost.value;
                    logToScreen(` ${adversary.name} marks ${action.cost.value} Stress (Total: ${adversary.current_stress})`);
                    applyCondition(primaryTarget, action.condition);
                } else {
                    logToScreen(` ${adversary.name} could not afford Stress cost to apply ${action.condition}.`);
                }
            } else {
                applyCondition(primaryTarget, action.condition);
            }
            break;
            
        case 'MOVE':
            logToScreen(` -> ${adversary.name} is moving as part of an action...`);
            moveAgentTowards(adversary, primaryTarget, gameState); // Pass gameState
            break;
        
        // --- NEW CASE BLOCKS ---
        case 'FORCE_MARK_ARMOR_SLOT':
            if (primaryTarget.current_armor_slots > 0) {
                primaryTarget.current_armor_slots--;
                logToScreen(` -> ${primaryTarget.name} is forced to mark 1 Armor Slot! (Slots left: ${primaryTarget.current_armor_slots})`);
            } else {
                logToScreen(` -> ${primaryTarget.name} has no Armor Slots to mark!`);
                // This is the FIX for Spit Acid's "on_fail"
                if (action.on_fail) {
                    logToScreen(` -> Triggering 'on_fail' logic for failing to mark armor...`);
                    // We must manually code the "additional HP" and "Gain Fear" from your text,
                    // as the JSON's `on_fail` is wrong.
                    if (adversary.name === "Acid Burrower") {
                        // "mark an additional HP"
                        logToScreen(` -> ${primaryTarget.name} marks an additional HP!`);
                        const damageInfo = { amount: 1, isDirect: true, isPhysical: false, isStandardAttack: false };
                        applyDamage(damageInfo, adversary, primaryTarget, gameState);
                        // "and you gain a Fear"
                        logToScreen(` -> GM gains 1 Fear!`);
                        gameState.fear = Math.min(12, gameState.fear + 1); // --- FEAR CAP ---
                        logToScreen(` GM Fear: ${gameState.fear}`);
                    } else {
                        // Fallback for other monsters (uses the JSON as-is)
                        for (const failAction of action.on_fail.actions) {
                            executeParsedEffect(failAction, adversary, primaryTarget, gameState);
                        }
                    }
                }
            }
            break;

        case 'CREATE_HAZARD':
            logToScreen(` -> ${adversary.name} creates a Hazard in ${action.range} range!`);
            logToScreen(` -> ${action.details.hazard_effect}`);
            logToScreen(` -> (Simulation logic for Hazards not yet implemented.)`);
            break;

        case 'NARRATIVE_EFFECT':
            logToScreen(` -> ${adversary.name} uses ${action.details.description}`);
            logToScreen(` -> (This is a narrative effect, no mechanical change in sim.)`);
            break;

        case 'TAKE_SPOTLIGHT':
            logToScreen(` -> ${adversary.name} takes the spotlight! (Effect not fully implemented)`);
            break;

        case 'GAIN_FEAR':
            const fearValue = action.value || 1;
            logToScreen(` -> GM gains ${fearValue} Fear!`);
            gameState.fear = Math.min(12, gameState.fear + fearValue); // --- FEAR CAP ---
            logToScreen(` GM Fear: ${gameState.fear}`);
            break;
        
        case 'KNOCKBACK':
            const kbRange = action.range || 'Very Close';
            logToScreen(` -> ${primaryTarget.name} is knocked back to ${kbRange} range!`);
            // Simple simulation: move them 2 squares away from the agent
            if (primaryTarget.position.x < adversary.position.x) {
                primaryTarget.position.x = Math.max(1, primaryTarget.position.x - 2);
            } else {
                primaryTarget.position.x = Math.min(CURRENT_BATTLEFIELD.MAX_X, primaryTarget.position.x + 2);
            }
            logToScreen(` -> ${primaryTarget.name} lands at (${primaryTarget.position.x}, ${primaryTarget.position.y})`);
            break;

        case 'PULL':
            const pullRange = action.range || 'Melee';
            logToScreen(` -> ${primaryTarget.name} is pulled into ${pullRange} range!`);
            // Simple simulation: move them to be adjacent to the agent
            primaryTarget.position.x = Math.max(1, adversary.position.x - 1);
            primaryTarget.position.y = adversary.position.y;
            logToScreen(` -> ${primaryTarget.name} lands at (${primaryTarget.position.x}, ${primaryTarget.position.y})`);
            break;

        case 'MODIFY_DAMAGE':
            // This is handled by the checkAdversaryReactions("BEFORE_DEALING_DAMAGE")
            // This case is a failsafe for other contexts
            logToScreen(` -> (MODIFY_DAMAGE action noted, but logic is handled by reaction.)`);
            break;
        
        default:
            logToScreen(` (Logic for action_type '${action.action_type}' not yet implemented.)`);
    }
}

function applyCondition(target, condition) {
    if (!target.conditions.includes(condition)) {
        target.conditions.push(condition);
        logToScreen(` ${target.name} is now ${condition}!`);
    }
}

function executeGMBasicAttack(adversary, target, gameState) {
    // --- NEW PATCH: Check for "attackAllInRange" passive (Cave Ogre) ---
    let targets = [target]; // Default to single target
    
    if (adversary.passives.attackAllInRange) {
        logToScreen(` -> ${adversary.name}'s 'Ramp Up' targets all players in range!`);
        const weaponRange = adversary.attack.range || 'Melee';
        targets = gameState.players.filter(p => p.current_hp > 0 && isTargetInRange(adversary, p, weaponRange));
    }
    // --- END PATCH ---

    for (const currentTarget of targets) {
        // --- NEW: Check for "Before Damage" reactions (e.g., Construct's Overload) ---
        let damageBonus = 0;
        let takeSpotlight = false;
        // NOTE: 'agent' is the one with the reaction (adversary), 'target' is who it's reacting to (currentTarget)
        const reactionResult = checkAdversaryReactions("BEFORE_DEALING_DAMAGE", adversary, currentTarget, gameState);
        if (reactionResult.damageBonus) {
            damageBonus = reactionResult.damageBonus;
        }
        if (reactionResult.takeSpotlight) {
            takeSpotlight = true;
        }
        // --- END NEW ---

        const roll = rollD20();
        const modifier = adversary.attack.modifier || 0;
        const totalAttack = roll + modifier; 
        
        logToScreen(` Roll vs ${currentTarget.name}: 1d20(${roll}) + ${modifier} = ${totalAttack} vs Evasion ${currentTarget.evasion}`);
        
        if (totalAttack >= currentTarget.evasion) {
            logToScreen('  HIT!');
            let damageString = adversary.attack.damage;
            let critBonus = 0;
            
            if (roll === 20) { 
                logToScreen('  CRITICAL HIT!');
                critBonus = parseDiceString(damageString).maxDie;
            }
            const damageTotal = rollDamage(damageString, 1, critBonus) + damageBonus; 
            
            const isDirect = adversary.passives.allAttacksAreDirect || false;
            
            const damageInfo = { 
                amount: damageTotal, 
                isDirect: isDirect, 
                isPhysical: (adversary.attack.damage.includes('phy')),
                isStandardAttack: true
            };
            applyDamage(damageInfo, adversary, currentTarget, gameState); 

            // --- NEW PATCH: Trigger "On Success" Reactions (Bear's Momentum) ---
            checkAdversaryReactions("ON_SUCCESSFUL_ATTACK", adversary, currentTarget, gameState, damageInfo);
            // --- END PATCH ---

        } else {
            logToScreen('  MISS!');
        }

        if (takeSpotlight) {
            logToScreen(` -> ${adversary.name} takes the spotlight again! (Logic not implemented)`);
        }
    }
}

// --- CORE SIMULATION FUNCTIONS ---
function isCombatOver(gameState) {
    const playersAlive = gameState.players.some(p => p.current_hp > 0);
    const adversariesAlive = gameState.adversaries.some(a => a.current_hp > 0);
    
    if (!playersAlive) { 
        logToScreen('--- All players are defeated! ---'); 
        return true; 
    }
    if (!adversariesAlive) { 
        logToScreen('--- All adversaries are defeated! ---'); 
        return true; 
    }
    return false;
}

// --- NEW FUNCTION: PC DAMAGE REACTION ---
function checkForPCDamageReactions(player, hpToMark, gameState) {
    // Check for Guardian's "Get Back Up"
    if (player.class === "Guardian" && hpToMark === 3) { // 3 HP = Severe Damage
        const getBackUpCard = player.domainCards.find(c => c.name === "Get Back Up");
        if (getBackUpCard && player.current_stress < player.max_stress) {
            player.current_stress++;
            logToScreen(` -> ${player.name} uses "Get Back Up"!`);
            logToScreen(` -> ${player.name} marks 1 Stress (Total: ${player.current_stress})`);
            return true; // Damage severity was successfully reduced
        }
    }

    // TODO: Add other damage reactions here (e.g., Dwarf's "Thick Skin")
    
    return false; // No reaction taken
}

// --- NEW FUNCTION: ADVERSARY REACTION LEXICON ---
function checkAdversaryReactions(trigger, agent, target, gameState, damageInfo = {}) {
    if (!agent.features) return { damageBonus: 0, takeSpotlight: false }; // Failsafe
    if (agent.current_hp <= 0 && trigger !== "ON_DEFEAT") return { damageBonus: 0, takeSpotlight: false }; 

    let reactionBonus = 0;
    let reactionSpotlight = false;

    for (const feature of agent.features) {
        if (feature.type !== 'reaction' || !feature.parsed_effect) continue;

        for (const action of feature.parsed_effect.actions) {
            if (action.trigger === trigger) {
                
                // Condition checks
                if (trigger === "ON_TAKE_DAMAGE") {
                    const hpThreshold = (action.trigger_details?.match(/(\d+)_HP_OR_MORE/) || [])[1]; // e.g. "ON_TAKE_DAMAGE_2_HP_OR_MORE"
                    if (hpThreshold && damageInfo.hpMarked < parseInt(hpThreshold)) {
                        continue; // Did not meet HP threshold
                    }
                }

                // Cost checks
                if (action.cost) {
                    if (action.cost.type === 'stress') {
                        if (agent.current_stress < agent.max_stress) {
                            agent.current_stress += action.cost.value;
                            logToScreen(` -> ${agent.name} marks ${action.cost.value} Stress for ${feature.name} (Total: ${agent.current_stress})`);
                        } else {
                            logToScreen(` -> ${agent.name} cannot afford Stress for ${feature.name}.`);
                            continue; // Can't pay cost
                        }
                    }
                    // TODO: Add Fear cost check
                }
                
                logToScreen(` -> ${agent.name}'s REACTION triggers: ${feature.name}!`);

                // Handle special cases for BEFORE_DEALING_DAMAGE (Construct's Overload)
                if (trigger === "BEFORE_DEALING_DAMAGE") {
                    if (action.action_type === 'MODIFY_DAMAGE') {
                        reactionBonus += action.details.bonus || 0;
                    }
                    if (action.action_type === 'TAKE_SPOTLIGHT') {
                        reactionSpotlight = true;
                    }
                } else {
                    // Execute the reaction's effect
                    executeParsedEffect(action, agent, target, gameState);
                }
            }
        }
    }
    
    return { damageBonus: reactionBonus, takeSpotlight: reactionSpotlight };
}


function processRollResources(result, gameState, player) {
    switch (result.outcome) {
        case 'CRITICAL_SUCCESS':
            gameState.hope = Math.min(player.max_hope, gameState.hope + 1);
            player.current_stress = Math.max(0, player.current_stress - 1); 
            logToScreen(` Resource: +1 Hope (Total: ${gameState.hope}), ${player.name} clears 1 Stress.`);
            break;
        case 'SUCCESS_WITH_HOPE':
            gameState.hope = Math.min(player.max_hope, gameState.hope + 1);
            logToScreen(` Resource: +1 Hope (Total: ${gameState.hope})`);
            break;
        case 'FAILURE_WITH_HOPE':
            gameState.hope = Math.min(player.max_hope, gameState.hope + 1);
            logToScreen(` Resource: +1 Hope (Total: ${gameState.hope})`);
            break;
        case 'SUCCESS_WITH_FEAR':
            gameState.fear = Math.min(12, gameState.fear + 1); // --- FEAR CAP ---
            logToScreen(` Resource: +1 Fear (Total: ${gameState.fear})`);
            break;
        case 'FAILURE_WITH_FEAR':
            gameState.fear = Math.min(12, gameState.fear + 1); // --- FEAR CAP ---
            logToScreen(` Resource: +1 Fear (Total: ${gameState.fear})`);
            break;
    }
}

// --- FULLY REPLACED applyDamage FUNCTION ---
function applyDamage(damageInfo, attacker, target, gameState) {
    
    let finalTarget = target;
    let isIntercepted = false;
    let { amount, isDirect, isPhysical, isStandardAttack } = damageInfo;

    // 1. Check for PC "take damage" reactions (e.g., I Am Your Shield)
    if (gameState && target.type === 'player') { 
        const interceptingPlayer = checkForPCReactions(amount, attacker, target, isDirect, gameState);
        if (interceptingPlayer) {
            finalTarget = interceptingPlayer; 
            isIntercepted = true;
        }
    }

    // 2. Calculate Severity
    let hpToMark = 0;
    let isMajor = false;
    let isSevere = false;
    
    if (!finalTarget.thresholds) {
        logToScreen(` (ERROR: Target ${finalTarget.name} has no thresholds defined!)`);
        if (amount > 0) hpToMark = 1; 
    } else {
        const severe = finalTarget.thresholds.severe || (finalTarget.thresholds.major ? finalTarget.thresholds.major * 2 : 999);
        const major = finalTarget.thresholds.major || (finalTarget.thresholds.severe ? finalTarget.thresholds.severe / 2 : 998);
        
        if (amount >= severe) {
            hpToMark = 3;
            isSevere = true;
            isMajor = true;
        } else if (amount >= major) {
            hpToMark = 2;
            isMajor = true;
        } else if (amount > 0) {
            hpToMark = 1;
        }
    }
    
    // 3. Apply Adversary Passives (e.g., Construct's Weak Structure)
    if (finalTarget.type === 'adversary' && finalTarget.passives.takeExtraPhysicalHP && isPhysical && hpToMark > 0) {
        logToScreen(` -> ${finalTarget.name}'s 'Weak Structure' passive applies!`);
        hpToMark += finalTarget.passives.takeExtraPhysicalHP;
    }

    let originalHPMark = hpToMark;
    logToScreen(` Damage: ${amount} (dealt by ${attacker.name}) vs ${finalTarget.name}'s Thresholds (${finalTarget.thresholds.major || 'N/A'}/${finalTarget.thresholds.severe || 'N/A'})`);
    logToScreen(` Calculated Severity: ${originalHPMark} HP`);
    
    // 4. Check for PC Damage *Mitigation* Reactions (e.g., Get Back Up)
    if (finalTarget.type === 'player' && hpToMark > 0) {
        const severityReduced = checkForPCDamageReactions(finalTarget, hpToMark, gameState);
        if (severityReduced) {
            hpToMark--;
            logToScreen(` -> Severity reduced by reaction! New HP to mark: ${hpToMark}`);
            if (originalHPMark === 3) isSevere = false; // No longer Severe
            if (originalHPMark === 2 && hpToMark < 2) isMajor = false; // No longer Major
        }
    }

    // 5. Apply Armor
    if (isIntercepted && finalTarget.class === "Guardian") {
        logToScreen(` -> Guardian "I Am Your Shield" applies!`);
        while (hpToMark > 0 && finalTarget.current_armor_slots > 0) {
            finalTarget.current_armor_slots--;
            hpToMark--;
            logToScreen(` ${finalTarget.name} marks 1 Armor Slot! (Slots left: ${finalTarget.current_armor_slots})`);
        }
    } 
    else if (finalTarget.type === 'player' && finalTarget.current_armor_slots > 0 && hpToMark > 0 && !isDirect) {
        finalTarget.current_armor_slots--;
        hpToMark--;
        logToScreen(` ${finalTarget.name} marks 1 Armor Slot! (Slots left: ${finalTarget.current_armor_slots})`);
    } else if (isDirect && finalTarget.type === 'player') {
        logToScreen(` This is DIRECT damage and cannot be mitigated by armor!`);
    }

    // 6. Apply Final Damage
    finalTarget.current_hp -= hpToMark;
    
    if (originalHPMark > hpToMark) {
        logToScreen(` Final HP marked: ${hpToMark}.`);
    } else if (originalHPMark > 0) {
        logToScreen(` Final HP marked: ${hpToMark}.`);
    }
    
    logToScreen(` ${finalTarget.name} HP: ${finalTarget.current_hp} / ${finalTarget.max_hp}`);
    
    // 7. Trigger Reactions based on this event
    const damageEventInfo = {
        amount: amount,
        hpMarked: hpToMark,
        isMajor: isMajor,
        isSevere: isSevere,
        isPhysical: isPhysical,
        isStandardAttack: isStandardAttack
    };

    if (finalTarget.type === 'adversary') {
        // Trigger "On Take Damage" reactions (e.g., Cave Ogre's Rampaging Fury)
        checkAdversaryReactions("ON_TAKE_DAMAGE", finalTarget, attacker, gameState, damageEventInfo);
        
        if (damageEventInfo.isSevere) {
            checkAdversaryReactions("ON_TAKE_SEVERE_DAMAGE", finalTarget, attacker, gameState, damageEventInfo);
        }
    }

    if (attacker.type === 'adversary' && hpToMark > 0) {
        // Trigger "On Deal HP" reactions
        checkAdversaryReactions("ON_DEAL_HP", attacker, finalTarget, gameState, damageEventInfo);
    }
    
    // 7.5. Check for "On Deal HP" PASSIVES
    if (attacker.type === 'adversary' && hpToMark > 0) {
        // Bear's "Overwhelming Force"
        if (damageInfo.isStandardAttack && attacker.passives.knockbackOnHP) {
             logToScreen(` -> ${attacker.name}'s PASSIVE triggers: Overwhelming Force!`);
             // Manually create and execute the knockback effect
             const knockbackEffect = {
                action_type: 'KNOCKBACK',
                range: attacker.passives.knockbackOnHP.range,
                is_direct: false // Not damage
             };
             executeParsedEffect(knockbackEffect, attacker, finalTarget, gameState);
        }
    }

    // 8. Check for Defeat
    if (finalTarget.current_hp <= 0) {
        logToScreen(` *** ${finalTarget.name} has been defeated! ***`);
        if (finalTarget.type === 'adversary') {
            checkAdversaryReactions("ON_DEFEAT", finalTarget, attacker, gameState, damageEventInfo);
        }
    }
}
// --- END FULL REPLACEMENT ---

function checkForPCReactions(damageTotal, attacker, target, isDirectDamage, gameState) {
    for (const potentialProtector of gameState.players) {
        if (potentialProtector.current_hp <= 0 || potentialProtector.id === target.id) {
            continue; 
        }

        if (potentialProtector.class === "Guardian") {
            const shieldCard = potentialProtector.domainCards.find(c => c.name === "I Am Your Shield");
            if (shieldCard) {
                if (potentialProtector.current_stress < potentialProtector.max_stress) {
                    if (isTargetInRange(potentialProtector, target, "Very Close")) {
                        potentialProtector.current_stress += 1; 
                        logToScreen(` -> ${potentialProtector.name} uses "I Am Your Shield"!`);
                        logToScreen(` -> ${potentialProtector.name} marks 1 Stress (Total: ${potentialProtector.current_stress})`);
                        return potentialProtector; 
                    }
                }
            }
        }
    }

    return null; // No one reacted
}


// --- CORE DICE & PARSING UTILITIES ---
function rollD20() { return Math.floor(Math.random() * 20) + 1; }
function rollD12() { return Math.floor(Math.random() * 12) + 1; }

function executeReactionRoll(target, trait, difficulty) {
    const roll = rollD20();
    const traitMod = target.traits[trait.toLowerCase()] || 0;
    const total = roll + traitMod;
    logToScreen(` ${target.name} makes a ${trait.toUpperCase()} Reaction Roll (Diff ${difficulty})`);
    logToScreen(` Roll: 1d20(${roll}) + ${trait}(${traitMod}) = ${total}`);
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
    if (typeof damageString !== 'string') {
        logToScreen(`(ERROR: Invalid damage string: ${damageString})`);
        return { numDice: 0, dieType: 0, modifier: 0, maxDie: 0 };
    }
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

// --- MOVEMENT & RANGE HELPER FUNCTIONS ---

function isCellOccupied(x, y, gameState, selfId) {
    const allAgents = [...gameState.players, ...gameState.adversaries];
    for (const agent of allAgents) {
        if (agent.id === selfId || agent.current_hp <= 0) {
            continue; 
        }
        if (agent.position.x === x && agent.position.y === y) {
            return true; 
        }
    }
    return false;
}

function getAgentDistance(agentA, agentB) {
    if (!agentA.position || !agentB.position) return 0;
    const dx = Math.abs(agentA.position.x - agentB.position.x);
    const dy = Math.abs(agentA.position.y - agentB.position.y);
    return dx + dy;
}

function isTargetInRange(attacker, target, weaponRangeName) {
    const distance = getAgentDistance(attacker, target);
    const range = (weaponRangeName || 'Melee').trim().toLowerCase();

    switch (range) {
        case 'self':
            return true;
        case 'melee':
            return distance <= CURRENT_BATTLEFIELD.RANGE_MELEE; // 1
        case 'very close':
            return distance <= CURRENT_BATTLEFIELD.RANGE_VERY_CLOSE; // 3
        case 'close':
            return distance <= CURRENT_BATTLEFIELD.RANGE_CLOSE; // 6
        case 'far':
            return distance <= CURRENT_BATTLEFIELD.RANGE_FAR; // 12
        default:
            logToScreen(`(Warning: Unknown range name '${weaponRangeName}')`);
            return false;
    }
}

function moveAgentTowards(agent, target, gameState) {
    let budget = agent.speed; 
    let currentX = agent.position.x;
    let currentY = agent.position.y;
    let moved = false;

    while (budget > 0) {
        let movedThisStep = false;
        const dx = target.position.x - currentX;
        const dy = target.position.y - currentY;

        if (getAgentDistance({position: {x: currentX, y: currentY}}, target) <= 1) {
            break;
        }

        if (Math.abs(dx) > Math.abs(dy)) {
            let nextX = currentX + Math.sign(dx);
            if (!isCellOccupied(nextX, currentY, gameState, agent.id)) {
                currentX = nextX;
                movedThisStep = true;
            }
        } else {
            let nextY = currentY + Math.sign(dy);
            if (!isCellOccupied(currentX, nextY, gameState, agent.id)) {
                currentY = nextY;
                movedThisStep = true;
            }
        }

        if (!movedThisStep) {
            if (Math.abs(dx) > Math.abs(dy)) { 
                let nextY = currentY + Math.sign(dy);
                if (dy !== 0 && !isCellOccupied(currentX, nextY, gameState, agent.id)) {
                    currentY = nextY;
                    movedThisStep = true;
                }
            } else { 
                let nextX = currentX + Math.sign(dx);
                if (dx !== 0 && !isCellOccupied(nextX, currentY, gameState, agent.id)) {
                    currentX = nextX;
                    movedThisStep = true;
                }
            }
        }

        if (!movedThisStep) {
            logToScreen(` -> ${agent.name} is blocked and cannot move further.`);
            break;
        }

        budget--;
        moved = true;
    }

    if (moved) {
        agent.position.x = currentX;
        agent.position.y = currentY;
        logToScreen(` -> ${agent.name} moves to (${currentX}, ${currentY})`);
    }
}
// --- END OF HELPER FUNCTIONS ---

// --- *** MODIFIED: logToScreen now supports "Blast Mode" *** ---
function logToScreen(message) {
    // If BATCH_LOG is active (not null), add to it instead of the DOM
    if (BATCH_LOG !== null) {
        BATCH_LOG.push(message);
        return;
    }

    // Otherwise, log to the screen as normal
    const logOutput = document.getElementById('log-output');
    if (logOutput) {
        logOutput.textContent += message + '\n';
        logOutput.scrollTop = logOutput.scrollHeight; 
    }
}

// --- VISUALIZER RENDER FUNCTION (NEW OPTIMIZED VERSION) ---
function initializeBattlemap(gameState) {
    const map = document.getElementById('battlemap-grid');
    if (!map) return;
    map.innerHTML = '';
    tokenCache = {}; // Reset token cache for visualization

    // 1. Draw the grid cells ONCE
    // --- FIX: Initialize CURRENT_BATTLEFIELD before use ---
    const mapSize = document.getElementById('map-size-select').value;
    CURRENT_BATTLEFIELD = {
        ...DAGGERHEART_RANGES,
        ...MAP_CONFIGS[mapSize] 
    };
    // --- END FIX ---

    map.style.gridTemplateColumns = `repeat(${CURRENT_BATTLEFIELD.MAX_X}, 1fr)`;
    map.style.gridTemplateRows = `repeat(${CURRENT_BATTLEFIELD.MAX_Y}, 1fr)`;
    
    let gridHtml = '';
    const totalCells = CURRENT_BATTLEFIELD.MAX_X * CURRENT_BATTLEFIELD.MAX_Y;
    for (let i = 0; i < totalCells; i++) {
        gridHtml += '<div class="empty-cell"></div>';
    }
    map.innerHTML = gridHtml;

    // 2. Create tokens ONCE (if gameState is provided)
    if (gameState) {
        initializeTokens(gameState);
    }
}

// --- NEW FUNCTION: initializeTokens ---
function initializeTokens(gameState) {
    const map = document.getElementById('battlemap-grid');
    if (!map) return;

    // Clear old tokens from cache and map
    for (const tokenId in tokenCache) {
        tokenCache[tokenId].remove();
    }
    tokenCache = {};

    // Create new tokens and add to cache
    for (const player of gameState.players) {
        const token = document.createElement('div');
        token.className = 'token player-token';
        token.id = player.id;
        map.appendChild(token);
        tokenCache[player.id] = token;
    }

    for (const adv of gameState.adversaries) {
        const token = document.createElement('div');
        token.className = 'token adversary-token';
        token.id = adv.id;
        map.appendChild(token);
        tokenCache[adv.id] = token;
    }
    
    // Do initial render
    renderBattlemap(gameState);
}

function renderBattlemap(gameState) {
    // This function NOW ONLY moves tokens
    
    for (const player of gameState.players) {
        const token = tokenCache[player.id];
        if (!token) continue;

        if (player.current_hp <= 0) {
            token.style.display = 'none';
        } else {
            token.style.display = 'block';
            token.title = `${player.name} (HP: ${player.current_hp})`;
            token.style.gridColumn = player.position.x;
            token.style.gridRow = player.position.y;
        }
    }

    for (const adv of gameState.adversaries) {
        const token = tokenCache[adv.id];
        if (!token) continue;
        
        if (adv.current_hp <= 0) {
            token.style.display = 'none';
        } else {
            token.style.display = 'block';
            token.title = `${adv.name} (HP: ${adv.current_hp})`;
            token.style.gridColumn = adv.position.x;
            token.style.gridRow = adv.position.y;
        }
    }
}