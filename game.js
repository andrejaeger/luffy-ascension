const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State Constants
const STATE_INTRO = 0;
const STATE_PLAYING = 1;
const STATE_GAMEOVER = 2;
const STATE_VICTORY = 3;
let gameState = STATE_INTRO;

// UI Elements
const introScreen = document.getElementById('intro-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const victoryScreen = document.getElementById('victory-screen');
const healthBar = document.getElementById('health-bar');
const energyBar = document.getElementById('energy-bar');
const heightVal = document.getElementById('height-val');
const scoreVal = document.getElementById('score-val');
const finalHeight = document.getElementById('final-height');
const finalScore = document.getElementById('final-score');
const victoryScore = document.getElementById('victory-score');

// Physics Configuration
const GRAVITY = 0.5;
const GROUND_Y = canvas.height - 40;
const BASE_RUN_SPEED = 3.5;
const JUMP_FORCE = -10.5;
const STRETCH_COST = 0.15;
const ENERGY_REGEN = 0.55;

// Game World Variables
let score = 0;
let distanceRun = 0;
let cameraX = 0;
let maxLevelDistance = 4500; // Target distance to win
let screenShake = 0;

// Player Object (Monkey D. Luffy)
const player = {
    x: 150,
    y: GROUND_Y - 32,
    vx: BASE_RUN_SPEED,
    vy: 0,
    width: 28,
    height: 38,
    health: 100,
    maxHealth: 100,
    energy: 100,
    maxEnergy: 100,
    isGrounded: false,
    invulnerableFrames: 0,
    
    // Grappling hook (Gomu Gomu Arm) state
    grapple: {
        active: false,
        tx: 0, // Target anchor x
        ty: 0, // Target anchor y
        length: 0, // Hook length
        maxLength: 320,
        k: 0.09, // Spring force
        damping: 0.95
    },

    // Animation frames (0 to 3 for running loop)
    animationFrame: 0,
    animationTimer: 0
};

// Hazard: Tsunami Deluge
const tsunami = {
    x: -120, // Chasing from left
    speed: 3.2,
    width: 180
};

// Entity Arrays
let platforms = []; // Wachtürme and structures
let enemies = [];
let playerProjectiles = [];
let enemyProjectiles = [];
let particles = [];

// Keyboard Controls
const keys = {
    a: false, d: false, ArrowLeft: false, ArrowRight: false,
    w: false, s: false, ArrowUp: false, ArrowDown: false,
    space: false
};

// Keyboard Listeners
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'a' || e.key === 'ArrowLeft') keys.a = true;
    if (key === 'd' || e.key === 'ArrowRight') keys.d = true;
    if (key === 'w' || e.key === 'ArrowUp') {
        keys.w = true;
        attemptJump();
    }
    if (key === 's' || e.key === 'ArrowDown') keys.s = true;
    if (e.key === ' ') {
        keys.space = true;
        shootProjectile();
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'a' || e.key === 'ArrowLeft') keys.a = false;
    if (key === 'd' || e.key === 'ArrowRight') keys.d = false;
    if (key === 'w' || e.key === 'ArrowUp') keys.w = false;
    if (key === 's' || e.key === 'ArrowDown') keys.s = false;
    if (e.key === ' ') keys.space = false;
});

// Click / Tap to Grapple high structures
canvas.addEventListener('mousedown', (e) => {
    if (gameState !== STATE_PLAYING) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width) + cameraX;
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // If clicking on lower half, jump instead
    if (clickY > GROUND_Y - 80) {
        attemptJump();
    } else {
        attemptGrapple(clickX, clickY);
    }
});

canvas.addEventListener('touchstart', (e) => {
    if (gameState !== STATE_PLAYING) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const clickX = (touch.clientX - rect.left) * (canvas.width / rect.width) + cameraX;
    const clickY = (touch.clientY - rect.top) * (canvas.height / rect.height);
    
    if (clickY > GROUND_Y - 80) {
        attemptJump();
    } else {
        attemptGrapple(clickX, clickY);
    }
    e.preventDefault();
}, { passive: false });

// UI Click Listeners
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', showIntroScreen);
document.getElementById('win-restart-btn').addEventListener('click', showIntroScreen);

function showIntroScreen() {
    gameState = STATE_INTRO;
    introScreen.classList.add('active');
    gameoverScreen.classList.remove('active');
    victoryScreen.classList.remove('active');
    
    // Set up basic mock elements
    score = 0;
    distanceRun = 0;
    cameraX = 0;
    tsunami.x = -150;
    tsunami.speed = 3.2;
    generateLevelSegments(0, 1000);
}

function startGame() {
    introScreen.classList.remove('active');
    gameoverScreen.classList.remove('active');
    victoryScreen.classList.remove('active');

    // Reset Player
    player.x = 150;
    player.y = GROUND_Y - 40;
    player.vx = BASE_RUN_SPEED;
    player.vy = 0;
    player.health = 100;
    player.energy = 100;
    player.grapple.active = false;

    // Reset World
    score = 0;
    distanceRun = 0;
    cameraX = 0;
    screenShake = 0;
    tsunami.x = -150;
    tsunami.speed = 3.2;

    platforms = [];
    enemies = [];
    playerProjectiles = [];
    enemyProjectiles = [];
    particles = [];

    // Pre-generate entire level
    generateLevel();

    gameState = STATE_PLAYING;
}

// Generate the whole side-scroller path
function generateLevel() {
    platforms = [];
    enemies = [];

    // Ground platform spanning the entire level
    platforms.push({
        x: 0,
        y: GROUND_Y,
        width: maxLevelDistance + 1000,
        height: 60,
        type: 'ground',
        color: '#1c2530'
    });

    // Spawn watchtowers and obstacles incrementally
    let currentX = 500;
    while (currentX < maxLevelDistance - 600) {
        const spacing = 320 + Math.random() * 250;
        const towerHeight = 120 + Math.random() * 80;
        
        // Spawn Watchtower
        platforms.push({
            x: currentX,
            y: GROUND_Y - towerHeight,
            width: 70,
            height: towerHeight,
            type: 'watchtower',
            color: '#3e2723', // Wooden brown columns
            deckY: GROUND_Y - towerHeight
        });

        // Spawn high grappling hook/lantern at top corner of watchtower
        platforms.push({
            x: currentX + 35,
            y: GROUND_Y - towerHeight - 20,
            width: 10,
            height: 10,
            type: 'grapple-node',
            color: '#ffcc00'
        });

        // Spawn barricades/spikes between watchtowers
        if (Math.random() < 0.5) {
            platforms.push({
                x: currentX - 120,
                y: GROUND_Y - 20,
                width: 30,
                height: 20,
                type: 'spikes',
                color: '#7f8c8d'
            });
        }

        // Spawn Marine Guard on watchtowers or ground
        if (Math.random() < 0.6) {
            enemies.push({
                x: currentX + 15,
                y: GROUND_Y - towerHeight - 32,
                width: 20,
                height: 32,
                patrolMin: currentX + 5,
                patrolMax: currentX + 50,
                vx: 0.6,
                direction: 1,
                health: 25,
                maxHealth: 25,
                shootCooldown: 80 + Math.random() * 100,
                type: 'guard'
            });
        } else {
            enemies.push({
                x: currentX - 180,
                y: GROUND_Y - 32,
                width: 20,
                height: 32,
                patrolMin: currentX - 250,
                patrolMax: currentX - 100,
                vx: 1.1,
                direction: 1,
                health: 20,
                maxHealth: 20,
                shootCooldown: 120,
                type: 'guard'
            });
        }

        currentX += spacing;
    }

    // Boss arena setup at the end
    const bossArenaX = maxLevelDistance - 300;
    platforms.push({
        x: bossArenaX,
        y: GROUND_Y - 180,
        width: 200,
        height: 15,
        type: 'boss-platform',
        color: '#4f5d75'
    });

    // Spawn Captain Smoker Boss
    enemies.push({
        x: bossArenaX + 80,
        y: GROUND_Y - 60,
        width: 36,
        height: 60,
        patrolMin: bossArenaX + 20,
        patrolMax: bossArenaX + 180,
        vx: 1.4,
        direction: 1,
        health: 300,
        maxHealth: 300,
        shootCooldown: 60,
        type: 'boss',
        smokeCharge: 0
    });
}

// Generate segments for the preview in intro screen
function generateLevelSegments(start, end) {
    platforms = [{ x: 0, y: GROUND_Y, width: 2000, height: 60, type: 'ground', color: '#1c2530' }];
    enemies = [];
}

// Luffy jump function
function attemptJump() {
    if (player.isGrounded) {
        player.vy = JUMP_FORCE;
        player.isGrounded = false;
        createSparks(player.x + player.width/2, player.y + player.height, '#ffffff', 4);
    }
}

// Attempt grappling hook
function attemptGrapple(clickX, clickY) {
    if (player.energy < 15) return;

    // Search for a grapple-node or top deck of watchtowers
    for (let platform of platforms) {
        if (platform.type === 'grapple-node' || platform.type === 'watchtower' || platform.type === 'boss-platform') {
            const px = platform.x + (platform.width / 2);
            const py = platform.y;
            
            // Check click alignment with platform
            if (clickX >= platform.x - 20 && clickX <= platform.x + platform.width + 20 &&
                clickY >= platform.y - 20 && clickY <= platform.y + platform.height + 20) {
                
                const dx = px - player.x;
                const dy = py - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist <= player.grapple.maxLength) {
                    player.grapple.active = true;
                    player.grapple.tx = px;
                    player.grapple.ty = py;
                    player.grapple.length = dist * 0.85; // Hook pulling factor
                    
                    player.energy -= 15;
                    createSparks(px, py, '#ffcc00', 8);
                    break;
                }
            }
        }
    }
}

// Ranged Punch Gomu Gomu no Pistol
function shootProjectile() {
    if (gameState !== STATE_PLAYING) return;
    if (player.energy < 25) return;

    player.energy -= 25;
    
    playerProjectiles.push({
        x: player.x + player.width,
        y: player.y + 12,
        vx: 9.5,
        vy: 0,
        width: 18,
        height: 18,
        damage: 18,
        type: 'fist'
    });

    createSparks(player.x + player.width, player.y + 16, '#ff3344', 4);
}

// Damage player
function damagePlayer(amt) {
    if (player.invulnerableFrames > 0) return;
    
    player.health = Math.max(0, player.health - amt);
    player.invulnerableFrames = 35;
    
    // Screen shake when hit
    screenShake = 12;
    createSparks(player.x + player.width/2, player.y + player.height/2, '#ff3344', 12);
}

// Particle system helper
function createSparks(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6 - 2,
            radius: 2 + Math.random() * 3,
            color: color,
            alpha: 1,
            decay: 0.02 + Math.random() * 0.03
        });
    }
}

// main update loop
function update() {
    if (gameState !== STATE_PLAYING) return;

    // Decaying screen shake
    if (screenShake > 0) screenShake *= 0.9;

    // 1. Invulnerability ticks
    if (player.invulnerableFrames > 0) player.invulnerableFrames--;

    // 2. Adjust running speed relative to A/D or Arrow keys
    if (keys.d) {
        player.vx = Math.min(BASE_RUN_SPEED + 3.0, player.vx + 0.15);
    } else if (keys.a) {
        player.vx = Math.max(BASE_RUN_SPEED - 1.5, player.vx - 0.1);
    } else {
        // Return to base run speed slowly
        if (player.vx > BASE_RUN_SPEED) player.vx -= 0.05;
        if (player.vx < BASE_RUN_SPEED) player.vx += 0.05;
    }

    // 3. Grapple rope mechanics
    if (player.grapple.active) {
        const dx = player.grapple.tx - player.x;
        const dy = player.grapple.ty - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Stamina consumption while hanging
        player.energy = Math.max(0, player.energy - STRETCH_COST);

        if (player.energy <= 0) {
            player.grapple.active = false;
        }

        // Adjustable length W/S
        if (keys.w) player.grapple.length = Math.max(40, player.grapple.length - 3.5);
        if (keys.s) player.grapple.length = Math.min(player.grapple.maxLength, player.grapple.length + 3.5);

        // Spring pull math
        if (dist > player.grapple.length) {
            const stretch = dist - player.grapple.length;
            const force = stretch * player.grapple.k;
            player.vx += (dx / dist) * force;
            player.vy += (dy / dist) * force;
        }

        // Release grapple automatically once swinging past target
        if (player.x > player.grapple.tx + 30) {
            player.grapple.active = false;
            // Swing velocity burst forward
            player.vx = Math.min(10, player.vx + 1.5);
        }
    } else {
        player.energy = Math.min(player.maxEnergy, player.energy + ENERGY_REGEN);
    }

    // 4. Player Physics and gravity
    player.vy += GRAVITY;
    
    // Auto-run movement integration
    player.x += player.vx;
    player.y += player.vy;

    // Ground platform collision
    player.isGrounded = false;
    if (player.y + player.height >= GROUND_Y) {
        player.y = GROUND_Y - player.height;
        player.vy = 0;
        player.isGrounded = true;
    }

    // 5. Tsunami chasing logic
    // Moves slightly slower than player, but speeds up if player is far away
    const distanceToWave = player.x - tsunami.x;
    if (distanceToWave > 350) {
        tsunami.speed = Math.max(3.2, player.vx * 0.95);
    } else if (distanceToWave < 120) {
        tsunami.speed = BASE_RUN_SPEED * 0.75; // Wave slows down to give breathing room
    }
    tsunami.x += tsunami.speed;

    // Check water overlap
    if (player.x < tsunami.x + 30) {
        damagePlayer(0.85); // Submerged in wave! Drains health
        screenShake = Math.max(screenShake, 5);

        // Splashes particles
        if (Math.random() < 0.3) {
            particles.push({
                x: tsunami.x + Math.random()*20,
                y: player.y + Math.random()*player.height,
                vx: 4 + Math.random()*3,
                vy: -Math.random()*4,
                radius: 3 + Math.random()*4,
                color: '#e0ffff',
                alpha: 0.8,
                decay: 0.03
            });
        }
    }

    if (player.health <= 0) {
        triggerGameOver();
    }

    // 6. Watchtowers and Spikes collision checks
    for (let p of platforms) {
        // Spikes check
        if (p.type === 'spikes') {
            if (player.x + player.width > p.x && player.x < p.x + p.width &&
                player.y + player.height >= p.y && player.y <= p.y + p.height) {
                damagePlayer(15);
                player.vy = -6; // bounce back
                player.vx *= 0.5;
            }
        }
        
        // Watchtower deck collision (can stand on top of watchtowers)
        if (p.type === 'watchtower' || p.type === 'boss-platform') {
            if (player.vx + player.x + player.width > p.x &&
                player.x < p.x + p.width &&
                player.y + player.height >= p.y &&
                player.y + player.height - player.vy <= p.y + 12) {
                
                player.y = p.y - player.height;
                player.vy = 0;
                player.isGrounded = true;
            }
        }
    }

    // 7. Player Projectiles updates
    for (let i = playerProjectiles.length - 1; i >= 0; i--) {
        const proj = playerProjectiles[i];
        proj.x += proj.vx;

        // Check range limits
        if (proj.x > cameraX + canvas.width + 100) {
            playerProjectiles.splice(i, 1);
            continue;
        }

        // Enemy collision checks
        for (let enemy of enemies) {
            if (proj.x + proj.width >= enemy.x && proj.x <= enemy.x + enemy.width &&
                proj.y + proj.height >= enemy.y && proj.y <= enemy.y + enemy.height) {
                
                enemy.health -= proj.damage;
                createSparks(proj.x, proj.y, '#ffcc00', 8);
                playerProjectiles.splice(i, 1);
                score += 40;

                if (enemy.health <= 0) {
                    createSparks(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#ff3344', 16);
                    enemies = enemies.filter(e => e !== enemy);
                    score += 200;

                    if (enemy.type === 'boss') {
                        triggerVictory();
                    }
                }
                break;
            }
        }
    }

    // 8. Enemy Updates (AI guards & Smoker Boss)
    for (let enemy of enemies) {
        // Move enemy
        enemy.x += enemy.vx * enemy.direction;

        if (enemy.x <= enemy.patrolMin) {
            enemy.direction = 1;
        } else if (enemy.x + enemy.width >= enemy.patrolMax) {
            enemy.direction = -1;
        }

        // Boss AI (Captain Smoker)
        if (enemy.type === 'boss') {
            enemy.shootCooldown--;
            if (enemy.shootCooldown <= 0) {
                enemy.shootCooldown = 90;
                
                // Smoke White Out attack
                enemyProjectiles.push({
                    x: enemy.x,
                    y: enemy.y + 20,
                    vx: -6,
                    vy: (player.y - enemy.y) * 0.005, // Slight homing
                    width: 32,
                    height: 20,
                    damage: 20,
                    type: 'smoke'
                });
                
                // Smoke particles
                createSparks(enemy.x, enemy.y + 20, '#d1d8e0', 10);
            }
        } else {
            // Guard AI shooting
            enemy.shootCooldown--;
            if (enemy.shootCooldown <= 0) {
                enemy.shootCooldown = 110 + Math.random() * 80;
                
                // Shoot musket towards Luffy
                const dx = player.x - enemy.x;
                const dy = player.y - enemy.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 400 && dx < 0) { // Only shoot if Luffy is approaching from left
                    enemyProjectiles.push({
                        x: enemy.x,
                        y: enemy.y + 12,
                        vx: -5.5,
                        vy: (player.y - enemy.y) * 0.01, // Aim vertical slightly
                        width: 6,
                        height: 6,
                        damage: 10,
                        type: 'bullet'
                    });
                }
            }
        }

        // Contact damage
        if (player.x + player.width >= enemy.x && player.x <= enemy.x + enemy.width &&
            player.y + player.height >= enemy.y && player.y <= enemy.y + enemy.height) {
            damagePlayer(enemy.type === 'boss' ? 22 : 12);
        }
    }

    // 9. Process Enemy Projectiles
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const proj = enemyProjectiles[i];
        proj.x += proj.vx;
        proj.y += proj.vy;

        // Boundaries
        if (proj.x < cameraX - 100 || proj.y > canvas.height) {
            enemyProjectiles.splice(i, 1);
            continue;
        }

        // Collision with player
        if (proj.x + proj.width >= player.x && proj.x <= player.x + player.width &&
            proj.y + proj.height >= player.y && proj.y <= player.y + player.height) {
            
            damagePlayer(proj.damage);
            createSparks(proj.x, proj.y, proj.type === 'smoke' ? '#d1d8e0' : '#ffffff', 8);
            enemyProjectiles.splice(i, 1);
        }
    }

    // 10. Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
            particles.splice(i, 1);
        }
    }

    // 11. Camera Scrolling X (Centering player, camera never goes backwards)
    const targetCamX = player.x - 180;
    if (targetCamX > cameraX) {
        cameraX += (targetCamX - cameraX) * 0.12;
    }

    // Update DistanceRun & HUD
    distanceRun = Math.floor(player.x / 10);
    updateHUD(distanceRun);
}

// Update HUD display
function updateHUD(dist) {
    healthBar.style.width = `${player.health}%`;
    energyBar.style.width = `${player.energy}%`;
    heightVal.textContent = `${dist}m`;
    scoreVal.textContent = score;
}

// Multi-Frame Procedural Pixel-Art Rendering for Luffy
// Animated based on distance run to synchronize leg swing speed
function drawLuffy(ctx, px, py) {
    const timeFrame = Math.floor(player.x / 14) % 4; // 4-frame cycle matching GIF
    const dir = 1; // Always facing right in runner
    
    ctx.save();
    ctx.translate(px + player.width/2, py + player.height/2);

    // Outline and base body scale (tilted running posture)
    ctx.rotate(0.12); 

    // Straw Hat (brim and crown with red ribbon)
    ctx.fillStyle = '#eedb52'; // Straw color
    ctx.fillRect(-12, -22, 24, 4); // Brim
    ctx.fillRect(-7, -27, 14, 5); // Crown
    ctx.fillStyle = '#ff3344'; // Red ribbon
    ctx.fillRect(-7, -23, 14, 2);

    // Head / Face
    ctx.fillStyle = '#ffccaa'; // Skin tone
    ctx.fillRect(-6, -18, 12, 8);
    // Face outline/hair (dark brown)
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(-7, -18, 2, 8); // Back hair
    ctx.fillRect(4, -14, 2, 2); // Eye pixel
    ctx.fillRect(-4, -10, 8, 2); // Mouth grin

    // Red Vest
    ctx.fillStyle = '#ff3344';
    ctx.fillRect(-8, -10, 16, 11);
    ctx.fillStyle = '#ffeedd'; // Skin opening on chest
    ctx.fillRect(-2, -10, 4, 6);

    // Blue Shorts
    ctx.fillStyle = '#3a86c8';
    ctx.fillRect(-8, 1, 16, 8);

    // Frame-based limb rendering (Runner Leg Cycle)
    ctx.fillStyle = '#ffccaa'; // Skin tone for limbs
    
    if (player.isGrounded) {
        if (timeFrame === 0) {
            // Left Leg forward, Right Leg back
            ctx.fillRect(2, 9, 5, 8); // Forward
            ctx.fillRect(-8, 9, 4, 8); // Back
            ctx.fillRect(-10, 15, 4, 2); // Back foot
        } else if (timeFrame === 1 || timeFrame === 3) {
            // Legs passing under body
            ctx.fillRect(-4, 9, 4, 8);
            ctx.fillRect(0, 9, 4, 8);
        } else if (timeFrame === 2) {
            // Right Leg forward, Left Leg back
            ctx.fillRect(-7, 9, 5, 8); // Back
            ctx.fillRect(3, 9, 4, 8); // Forward
            ctx.fillRect(5, 15, 4, 2); // Forward foot
        }
    } else {
        // Jumping/Swinging frame
        ctx.fillRect(-6, 9, 4, 6);
        ctx.fillRect(2, 9, 4, 8);
        ctx.fillRect(4, 15, 4, 2);
    }

    // Arm swing cycle (draw left/right arms)
    ctx.fillStyle = '#ffccaa';
    if (player.grapple.active) {
        // Grappling hand is pointing to target - handled in background draw
    } else {
        // Run cycle arms swinging
        if (timeFrame === 0 || timeFrame === 2) {
            ctx.fillRect(-11, -8, 3, 7); // Back arm
            ctx.fillRect(8, -6, 4, 4); // Forward hand
        } else {
            ctx.fillRect(8, -8, 3, 7); // Forward arm
            ctx.fillRect(-11, -6, 4, 4); // Back hand
        }
    }

    ctx.restore();
}

// Draw screen elements
function draw() {
    // Apply camera shaking
    ctx.save();
    if (screenShake > 0.1) {
        const dx = (Math.random() - 0.5) * screenShake;
        const dy = (Math.random() - 0.5) * screenShake;
        ctx.translate(dx, dy);
    }

    // Clear Screen
    ctx.fillStyle = '#0f141d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Translate for camera scroll X
    ctx.translate(-cameraX, 0);

    // 1. Draw Background layers (Scrolling parallax mountains / outposts)
    ctx.fillStyle = '#161d28';
    for (let i = Math.floor(cameraX / 400) * 400 - 400; i < cameraX + canvas.width + 400; i += 400) {
        ctx.fillRect(i + 50, 180, 150, GROUND_Y - 180); // Background rock pillars
        ctx.fillRect(i + 250, 230, 80, GROUND_Y - 230);
    }

    // 2. Draw Ground and Platforms
    for (let p of platforms) {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.width, p.height);

        // Platform highlighting
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(p.x, p.y, p.width, 3);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(p.x, p.y + p.height - 4, p.width, 4);

        // Watchtower detailing
        if (p.type === 'watchtower') {
            // Draw support cross pillars
            ctx.strokeStyle = '#2d1b18';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(p.x + 10, p.y);
            ctx.lineTo(p.x + p.width - 10, p.y + p.height);
            ctx.moveTo(p.x + p.width - 10, p.y);
            ctx.lineTo(p.x + 10, p.y + p.height);
            ctx.stroke();

            // Draw deck guardrail
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(p.x - 5, p.y - 12, p.width + 10, 4);
        }
    }

    // 3. Draw Enemies
    for (let enemy of enemies) {
        if (enemy.type === 'boss') {
            // Draw Captain Smoker floating on white smoke plumes
            ctx.fillStyle = '#d1d8e0'; // Smoke body bottom
            ctx.fillRect(enemy.x - 5, enemy.y + enemy.height - 20, enemy.width + 10, 20);
            ctx.fillStyle = '#4f5d75'; // Blue coat
            ctx.fillRect(enemy.x, enemy.y + 10, enemy.width, enemy.height - 25);
            ctx.fillStyle = '#ffffff'; // White hair
            ctx.fillRect(enemy.x + 10, enemy.y - 8, enemy.width - 20, 8);
            ctx.fillStyle = '#ffccaa'; // Face
            ctx.fillRect(enemy.x + 8, enemy.y, enemy.width - 16, 10);
            
            // Jitte Weapon behind shoulder
            ctx.strokeStyle = '#7f8c8d';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(enemy.x + enemy.width, enemy.y + 20);
            ctx.lineTo(enemy.x + enemy.width + 10, enemy.y - 10);
            ctx.stroke();
        } else {
            // Draw Marine Guard (Uniform blue/white cap)
            ctx.fillStyle = '#ffffff'; // White shirt
            ctx.fillRect(enemy.x, enemy.y + 8, enemy.width, enemy.height - 20);
            ctx.fillStyle = '#0f2042'; // Blue trousers
            ctx.fillRect(enemy.x, enemy.y + enemy.height - 12, enemy.width, 12);
            ctx.fillStyle = '#ffffff'; // Cap
            ctx.fillRect(enemy.x + 2, enemy.y - 6, enemy.width - 4, 6);
            ctx.fillStyle = '#0f2042'; // Cap brim
            ctx.fillRect(enemy.x + (enemy.direction === 1 ? enemy.width - 5 : 0), enemy.y - 2, 5, 2);
        }

        // Enemy Health Display
        if (enemy.health < enemy.maxHealth) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(enemy.x - 5, enemy.y - 16, enemy.width + 10, 4);
            ctx.fillStyle = '#ff3344';
            ctx.fillRect(enemy.x - 5, enemy.y - 16, (enemy.width + 10) * (enemy.health / enemy.maxHealth), 4);
        }
    }

    // 4. Draw Player Projectiles (Gomu Gomu fist project)
    ctx.fillStyle = '#ffaa99';
    for (let proj of playerProjectiles) {
        ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
        
        // Stretch Arm attachment (draw the long stretched arm from player back to project)
        ctx.strokeStyle = '#ffccaa';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(player.x + player.width/2, player.y + 12);
        ctx.lineTo(proj.x, proj.y + proj.height/2);
        ctx.stroke();
    }

    // 5. Draw Enemy Projectiles (bullets and smoke blasts)
    for (let proj of enemyProjectiles) {
        if (proj.type === 'smoke') {
            ctx.fillStyle = 'rgba(209, 216, 224, 0.7)';
            ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
        } else {
            ctx.fillStyle = '#ffd152';
            ctx.beginPath();
            ctx.arc(proj.x + 3, proj.y + 3, 3, 0, Math.PI*2);
            ctx.fill();
        }
    }

    // 6. Draw Grappling Arm (Gomu Gomu stretchy arm)
    if (player.grapple.active) {
        ctx.strokeStyle = '#ffccaa'; // Flesh tone
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(player.x + player.width/2, player.y + 10);
        ctx.lineTo(player.grapple.tx, player.grapple.ty);
        ctx.stroke();

        // Draw muscle grapple hand at target end
        ctx.fillStyle = '#ff8866';
        ctx.fillRect(player.grapple.tx - 6, player.grapple.ty - 6, 12, 12);
    }

    // 7. Draw Luffy
    if (player.invulnerableFrames === 0 || Math.floor(player.invulnerableFrames / 3) % 2 === 0) {
        drawLuffy(ctx, player.x, player.y);
    }

    // 8. Draw Particle system
    for (let p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0; // Reset alpha

    // 9. Draw Chasing Tsunami wave (From the Left)
    // Draw wavy transparency cyan tsunami wall
    ctx.fillStyle = 'rgba(0, 255, 255, 0.45)';
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 4;

    ctx.beginPath();
    const waveTime = Date.now() * 0.006;
    ctx.moveTo(cameraX - 100, GROUND_Y + 100);
    ctx.lineTo(tsunami.x, GROUND_Y + 100);
    // Draw waves going upwards
    for (let y = GROUND_Y; y >= -100; y -= 15) {
        const waveOffset = Math.sin(y * 0.045 + waveTime) * 14;
        ctx.lineTo(tsunami.x + waveOffset, y);
    }
    ctx.lineTo(cameraX - 100, -100);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Foam particles on the water crest
    ctx.fillStyle = '#ffffff';
    for (let y = GROUND_Y; y >= -100; y -= 40) {
        const waveOffset = Math.sin(y * 0.045 + waveTime) * 14;
        ctx.fillRect(tsunami.x + waveOffset - 4, y, 8, 8);
    }

    ctx.restore(); // Restore cameraX
    ctx.restore(); // Restore screen shake
}

// Game Over state triggers
function triggerGameOver() {
    gameState = STATE_GAMEOVER;
    gameoverScreen.classList.add('active');
    finalHeight.textContent = `${distanceRun}m`;
    finalScore.textContent = score;
}

// Victory triggers
function triggerVictory() {
    gameState = STATE_VICTORY;
    victoryScreen.classList.add('active');
    victoryScore.textContent = score;
}

// Main animation loop
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// Initialize
showIntroScreen();
loop();
