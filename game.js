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
const GRAVITY = 0.45;
const FRICTION = 0.98;
const CLIMB_SPEED = 0.4;
const PUNCH_RANGE = 45;
const STRETCH_COST = 0.15; // Energy cost per frame while grappling
const ENERGY_REGEN = 0.4;

// Game World Variables
let score = 0;
let highestY = 0;
let cameraY = 0;
let maxLevelHeight = 4500; // Height of the boss platform

// Player Object
const player = {
    x: canvas.width / 2,
    y: canvas.height - 100,
    vx: 0,
    vy: 0,
    width: 24,
    height: 32,
    health: 100,
    maxHealth: 100,
    energy: 100,
    maxEnergy: 100,
    direction: 1, // 1 = right, -1 = left
    isGrounded: false,
    
    // Grappling hook (Gomu Gomu Arm) state
    grapple: {
        active: false,
        tx: 0, // Target x
        ty: 0, // Target y
        length: 0, // Current arm length
        maxLength: 350,
        k: 0.08, // Spring constant
        damping: 0.94,
        angle: 0
    },

    // Combat state
    punching: false,
    punchCooldown: 0,
    invulnerableFrames: 0
};

// Projectiles & Particles & Enemies
let platforms = [];
let enemies = [];
let playerProjectiles = [];
let enemyProjectiles = [];
let particles = [];
let waterLevel = canvas.height; // Rising water level
let waterSpeed = 0.65;
let waterPulseTimer = 0;

// Key Tracking
const keys = {
    a: false, d: false, ArrowLeft: false, ArrowRight: false,
    w: false, s: false, ArrowUp: false, ArrowDown: false,
    space: false
};

// Event Listeners for Keyboard
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'a' || e.key === 'ArrowLeft') keys.a = true;
    if (key === 'd' || e.key === 'ArrowRight') keys.d = true;
    if (key === 'w' || e.key === 'ArrowUp') keys.w = true;
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

// Click / Tap to Grapple
canvas.addEventListener('mousedown', (e) => {
    if (gameState !== STATE_PLAYING) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (e.clientY - rect.top) * (canvas.height / rect.height) + cameraY;
    
    attemptGrapple(clickX, clickY);
});

// Touch controls support
canvas.addEventListener('touchstart', (e) => {
    if (gameState !== STATE_PLAYING) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const clickX = (touch.clientX - rect.left) * (canvas.width / rect.width);
    const clickY = (touch.clientY - rect.top) * (canvas.height / rect.height) + cameraY;
    
    attemptGrapple(clickX, clickY);
    e.preventDefault();
}, { passive: false });

// UI Click Listeners
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('win-restart-btn').addEventListener('click', startGame);

function startGame() {
    introScreen.classList.remove('active');
    gameoverScreen.classList.remove('active');
    victoryScreen.classList.remove('active');

    // Reset game world
    score = 0;
    cameraY = 0;
    highestY = canvas.height - 100;
    waterLevel = canvas.height + 200;
    waterSpeed = 0.65;
    waterPulseTimer = 0;

    // Reset player
    player.x = canvas.width / 2;
    player.y = canvas.height - 100;
    player.vx = 0;
    player.vy = 0;
    player.health = 100;
    player.energy = 100;
    player.grapple.active = false;
    player.punching = false;

    playerProjectiles = [];
    enemyProjectiles = [];
    particles = [];
    
    // Re-generate Level
    generateLevel();

    gameState = STATE_PLAYING;
}

// Generate level platforms and enemies
function generateLevel() {
    platforms = [];
    enemies = [];

    // Base ground platform
    platforms.push({
        x: 0,
        y: canvas.height - 40,
        width: canvas.width,
        height: 60,
        type: 'standard',
        color: '#2b384c'
    });

    // Generate ascending platforms procedurally
    let currentY = canvas.height - 150;
    
    while (currentY > -maxLevelHeight) {
        const platformWidth = 80 + Math.random() * 60;
        const platformX = Math.random() * (canvas.width - platformWidth);
        const rand = Math.random();
        
        let ptype = 'standard';
        let pcolor = '#2d4059';
        
        if (rand < 0.15) {
            ptype = 'breakable';
            pcolor = '#ff6b6b';
        } else if (rand < 0.25) {
            ptype = 'bouncy';
            pcolor = '#e2c044';
        }

        platforms.push({
            x: platformX,
            y: currentY,
            width: platformWidth,
            height: 15,
            type: ptype,
            color: pcolor,
            breakTimer: 0 // Used for breakable platforms
        });

        // Spawn enemies on standard platforms
        if (ptype === 'standard' && Math.random() < 0.35 && currentY < canvas.height - 400) {
            enemies.push({
                x: platformX + platformWidth / 2,
                y: currentY - 32,
                width: 20,
                height: 32,
                patrolMin: platformX,
                patrolMax: platformX + platformWidth - 20,
                vx: 0.8 + Math.random() * 0.7,
                direction: 1,
                health: 30,
                maxHealth: 30,
                shootCooldown: 60 + Math.random() * 120,
                type: 'guard'
            });
        }

        // Gradual increase in spacing as the level goes higher
        const spacing = 110 + Math.min(60, Math.floor(Math.abs(currentY) / 100) * 2);
        currentY -= spacing;
    }

    // Boss Platform at the very top
    const bossPlatformY = -maxLevelHeight;
    platforms.push({
        x: 40,
        y: bossPlatformY,
        width: canvas.width - 80,
        height: 30,
        type: 'boss-deck',
        color: '#4f5d75'
    });

    // Spawn Boss
    enemies.push({
        x: canvas.width / 2 - 20,
        y: bossPlatformY - 60,
        width: 40,
        height: 60,
        patrolMin: 60,
        patrolMax: canvas.width - 100,
        vx: 1.2,
        direction: 1,
        health: 250,
        maxHealth: 250,
        shootCooldown: 80,
        type: 'boss'
    });
}

// Check and activate grappling arm
function attemptGrapple(tx, ty) {
    if (player.energy < 10) return; // Need minimum energy to grapple
    
    // Find if the click hit a platform
    for (let platform of platforms) {
        if (tx >= platform.x && tx <= platform.x + platform.width &&
            ty >= platform.y && ty <= platform.y + platform.height) {
            
            // Calculate distance
            const dx = tx - player.x;
            const dy = ty - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= player.grapple.maxLength) {
                // Activate grapple
                player.grapple.active = true;
                player.grapple.tx = tx;
                player.grapple.ty = ty;
                player.grapple.length = dist;
                
                // Spawn impact particles
                createSparks(tx, ty, '#ffcc00', 8);
                break;
            }
        }
    }
}

// Luffy's ranged attack (Gear Third fist projectile)
function shootProjectile() {
    if (gameState !== STATE_PLAYING) return;
    if (player.energy < 20) return; // Ranged attack consumes energy

    player.energy -= 20;
    
    // Shoot projectile in facing direction
    playerProjectiles.push({
        x: player.x + (player.direction === 1 ? player.width : -10),
        y: player.y + player.height / 2 - 8,
        vx: player.direction * 8,
        vy: 0,
        width: 16,
        height: 16,
        damage: 15,
        type: 'fist'
    });

    createSparks(player.x + (player.direction === 1 ? player.width : 0), player.y + player.height / 2, '#ff3344', 4);
}

// Particle system helper
function createSparks(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            radius: 2 + Math.random() * 3,
            color: color,
            alpha: 1,
            decay: 0.02 + Math.random() * 0.03
        });
    }
}

// Main Update Loop
function update() {
    if (gameState !== STATE_PLAYING) return;

    // 1. Invulnerability frames countdown
    if (player.invulnerableFrames > 0) player.invulnerableFrames--;

    // 2. Horizontal Keyboard Controls (only if not swinging extremely fast)
    if (keys.a) {
        player.vx = -4;
        player.direction = -1;
    } else if (keys.d) {
        player.vx = 4;
        player.direction = 1;
    } else {
        player.vx *= FRICTION; // Slide friction
    }

    // 3. Elastic Spring / Grappling Hook Physics
    if (player.grapple.active) {
        const dx = player.grapple.tx - player.x;
        const dy = player.grapple.ty - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Consume energy while hanging/pulling
        player.energy = Math.max(0, player.energy - STRETCH_COST);

        // Cancel grapple if energy is completely drained
        if (player.energy <= 0) {
            player.grapple.active = false;
        }

        // Length adjustments via W/S keys
        if (keys.w) {
            player.grapple.length = Math.max(30, player.grapple.length - 3);
        }
        if (keys.s) {
            player.grapple.length = Math.min(player.grapple.maxLength, player.grapple.length + 3);
        }

        // Apply hook physics if stretched beyond target length
        if (dist > player.grapple.length) {
            const stretch = dist - player.grapple.length;
            const force = stretch * player.grapple.k;
            
            // Force vector
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            player.vx += fx;
            player.vy += fy;
        }

        // Release grapple if clicking space or target height reached
        if (player.y < player.grapple.ty + 10) {
            // Give slight boost
            player.vy = -3;
        }
    } else {
        // Regenerate stamina when not grappling
        player.energy = Math.min(player.maxEnergy, player.energy + ENERGY_REGEN);
    }

    // 4. Gravity & Velocity Application
    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;

    // Boundary constraints
    if (player.x < 0) {
        player.x = 0;
        player.vx = 0;
    }
    if (player.x + player.width > canvas.width) {
        player.x = canvas.width - player.width;
        player.vx = 0;
    }

    // 5. Rising Water level calculations
    waterPulseTimer++;
    // Periodic volcanic eruptive surge
    if (waterPulseTimer > 400) {
        waterPulseTimer = 0;
        waterLevel -= 60; // Huge surge upwards
        createSparks(canvas.width / 2, waterLevel, '#ffffff', 20);
    }
    
    // Normal steady water rise (accelerates as Luffy gets higher)
    const altitudeMultiplier = Math.max(1, Math.floor(Math.abs(player.y) / 1000));
    waterLevel -= waterSpeed * altitudeMultiplier;

    // Check water immersion
    if (player.y + player.height > waterLevel) {
        // Submerged! Drain health
        player.health = Math.max(0, player.health - 0.7);
        // Water splash bubbles
        if (Math.random() < 0.25) {
            particles.push({
                x: player.x + Math.random() * player.width,
                y: player.y + player.height,
                vx: (Math.random() - 0.5) * 2,
                vy: -Math.random() * 3,
                radius: 3 + Math.random() * 4,
                color: '#e0ffff',
                alpha: 0.8,
                decay: 0.02
            });
        }
    }

    // Check game over
    if (player.health <= 0) {
        triggerGameOver();
    }

    // 6. Platform Collisions
    player.isGrounded = false;
    for (let platform of platforms) {
        // Check if player lands on top of a platform
        if (player.vx + player.x + player.width > platform.x &&
            player.x < platform.x + platform.width &&
            player.y + player.height >= platform.y &&
            player.y + player.height - player.vy <= platform.y + 8) {
            
            // Land on top
            player.y = platform.y - player.height;
            player.vy = 0;
            player.isGrounded = true;

            // Handle platform types
            if (platform.type === 'bouncy') {
                player.vy = -12; // High jump boost
                createSparks(player.x + player.width/2, platform.y, '#e2c044', 8);
            }
            if (platform.type === 'breakable') {
                platform.breakTimer++;
                if (platform.breakTimer > 45) {
                    // Destroy platform
                    createSparks(platform.x + platform.width/2, platform.y, '#ff6b6b', 12);
                    platforms = platforms.filter(p => p !== platform);
                }
            }
        }
    }

    // 7. Process Player Projectiles
    for (let i = playerProjectiles.length - 1; i >= 0; i--) {
        const proj = playerProjectiles[i];
        proj.x += proj.vx;

        // Check boundary
        if (proj.x < 0 || proj.x > canvas.width) {
            playerProjectiles.splice(i, 1);
            continue;
        }

        // Hit checks with enemies
        for (let enemy of enemies) {
            if (proj.x + proj.width >= enemy.x && proj.x <= enemy.x + enemy.width &&
                proj.y + proj.height >= enemy.y && proj.y <= enemy.y + enemy.height) {
                
                enemy.health -= proj.damage;
                createSparks(proj.x, proj.y, '#ffcc00', 8);
                playerProjectiles.splice(i, 1);

                // Add points
                score += 50;

                // Handle enemy defeat
                if (enemy.health <= 0) {
                    createSparks(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#ff3344', 15);
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

    // 8. Process Enemies (Patrol & AI Shooting)
    for (let enemy of enemies) {
        // Move enemy
        enemy.x += enemy.vx * enemy.direction;

        if (enemy.x <= enemy.patrolMin) {
            enemy.direction = 1;
        } else if (enemy.x + enemy.width >= enemy.patrolMax) {
            enemy.direction = -1;
        }

        // Shoot at player
        enemy.shootCooldown--;
        if (enemy.shootCooldown <= 0) {
            enemy.shootCooldown = enemy.type === 'boss' ? 70 : 120 + Math.random() * 100;
            
            // Aim at player
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Musket shooting range limits
            if (dist < 450) {
                const angle = Math.atan2(dy, dx);
                enemyProjectiles.push({
                    x: enemy.x + enemy.width/2,
                    y: enemy.y + enemy.height/3,
                    vx: Math.cos(angle) * (enemy.type === 'boss' ? 5 : 3.5),
                    vy: Math.sin(angle) * (enemy.type === 'boss' ? 5 : 3.5),
                    width: 6,
                    height: 6,
                    damage: enemy.type === 'boss' ? 15 : 10
                });
            }
        }

        // Direct player-enemy body contact (damages player)
        if (player.x + player.width >= enemy.x && player.x <= enemy.x + enemy.width &&
            player.y + player.height >= enemy.y && player.y <= enemy.y + enemy.height) {
            damagePlayer(enemy.type === 'boss' ? 20 : 15);
        }
    }

    // 9. Process Enemy Projectiles
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const proj = enemyProjectiles[i];
        proj.x += proj.vx;
        proj.y += proj.vy;

        // Check boundaries
        if (proj.x < 0 || proj.x > canvas.width || proj.y < cameraY || proj.y > cameraY + canvas.height) {
            enemyProjectiles.splice(i, 1);
            continue;
        }

        // Hit check with player
        if (proj.x + proj.width >= player.x && proj.x <= player.x + player.width &&
            proj.y + proj.height >= player.y && proj.y <= player.y + player.height) {
            
            damagePlayer(proj.damage);
            createSparks(proj.x, proj.y, '#ffffff', 8);
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

    // 11. Camera Tracking (Y scrolls upwards with Luffy, never back down)
    const targetCamY = player.y - canvas.height / 2 + 100;
    if (targetCamY < cameraY) {
        cameraY += (targetCamY - cameraY) * 0.15;
    }

    // Update Altitudes/Score Metrics
    const currentHeight = Math.max(0, Math.floor((canvas.height - 100 - player.y) / 10));
    if (currentHeight > highestY) {
        highestY = currentHeight;
        score += (currentHeight - highestY) * 10; // Extra points for climbing higher
    }

    updateHUD(currentHeight);
}

// Damage player utility
function damagePlayer(amt) {
    if (player.invulnerableFrames > 0) return;
    
    player.health = Math.max(0, player.health - amt);
    player.invulnerableFrames = 30; // 0.5s invulnerability frames
    
    // Spawn damage splat particles
    createSparks(player.x + player.width/2, player.y + player.height/2, '#ff3344', 12);
}

// Update HUD displays
function updateHUD(currentHeight) {
    healthBar.style.width = `${player.health}%`;
    energyBar.style.width = `${player.energy}%`;
    heightVal.textContent = `${currentHeight}m`;
    scoreVal.textContent = score;
}

// Draw Loop
function draw() {
    // Clear screen
    ctx.fillStyle = '#090b0e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Translate canvas for vertical scrolling camera
    ctx.translate(0, -cameraY);

    // 1. Draw Background Details (procedural brick wall textures)
    ctx.fillStyle = '#10141d';
    for (let i = Math.floor(cameraY / 100) * 100; i < cameraY + canvas.height + 100; i += 100) {
        ctx.fillRect(20, i, 4, 80);
        ctx.fillRect(canvas.width - 24, i + 50, 4, 80);
    }

    // 2. Draw Platforms
    for (let platform of platforms) {
        ctx.fillStyle = platform.color;
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);

        // Platform detailing (caps, cracks, textures)
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(platform.x, platform.y, platform.width, 3); // top lighting border
        
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(platform.x, platform.y + platform.height - 4, platform.width, 4); // bottom shadow

        // If breakable, draw cracks proportional to timer
        if (platform.type === 'breakable' && platform.breakTimer > 0) {
            ctx.fillStyle = '#ff6b6b';
            ctx.fillRect(platform.x + Math.random()*platform.width, platform.y, 3, platform.height);
        }
    }

    // 3. Draw Enemies
    for (let enemy of enemies) {
        if (enemy.type === 'boss') {
            // Draw Marine Captain Boss
            ctx.fillStyle = '#1e2530'; // Coat
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            ctx.fillStyle = '#ffffff'; // Shirt
            ctx.fillRect(enemy.x + 5, enemy.y + 10, enemy.width - 10, 15);
            ctx.fillStyle = '#3a86c8'; // Cape
            ctx.fillRect(enemy.x - 4, enemy.y + 5, 4, enemy.height - 10);
            ctx.fillRect(enemy.x + enemy.width, enemy.y + 5, 4, enemy.height - 10);
            ctx.fillStyle = '#ffd152'; // Epaulettes
            ctx.fillRect(enemy.x - 4, enemy.y, 8, 5);
            ctx.fillRect(enemy.x + enemy.width - 4, enemy.y, 8, 5);
            // Cap
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(enemy.x + 5, enemy.y - 8, enemy.width - 10, 8);
            ctx.fillStyle = '#000';
            ctx.fillRect(enemy.x + 2, enemy.y - 2, enemy.width - 4, 2);
        } else {
            // Draw Marine Guard
            ctx.fillStyle = '#ffffff'; // Uniform white
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            ctx.fillStyle = '#0f2042'; // Pants/accents
            ctx.fillRect(enemy.x, enemy.y + enemy.height - 12, enemy.width, 12);
            ctx.fillStyle = '#ffffff'; // Hat
            ctx.fillRect(enemy.x + 2, enemy.y - 6, enemy.width - 4, 6);
            ctx.fillStyle = '#0f2042'; // Cap visor
            ctx.fillRect(enemy.x + (enemy.direction === 1 ? enemy.width - 6 : 0), enemy.y - 2, 6, 2);
        }

        // Health bars above enemies
        if (enemy.health < enemy.maxHealth) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(enemy.x - 5, enemy.y - 15, enemy.width + 10, 4);
            ctx.fillStyle = '#ff3344';
            ctx.fillRect(enemy.x - 5, enemy.y - 15, (enemy.width + 10) * (enemy.health / enemy.maxHealth), 4);
        }
    }

    // 4. Draw Player Projectiles
    ctx.fillStyle = '#ff8899';
    for (let proj of playerProjectiles) {
        ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
        // Draw trailing path
        ctx.fillStyle = 'rgba(255, 136, 153, 0.2)';
        ctx.fillRect(proj.x - proj.vx, proj.y + 2, proj.width, proj.height - 4);
    }

    // 5. Draw Enemy Projectiles (bullets)
    ctx.fillStyle = '#ffd152';
    for (let proj of enemyProjectiles) {
        ctx.beginPath();
        ctx.arc(proj.x + proj.width/2, proj.y + proj.height/2, proj.width/2, 0, Math.PI * 2);
        ctx.fill();
    }

    // 6. Draw Grappling Arm (Gomu Gomu rubber)
    if (player.grapple.active) {
        ctx.strokeStyle = '#e0a080'; // Skin/flesh pinkish-orange tone
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(player.x + player.width / 2, player.y + 10);
        ctx.lineTo(player.grapple.tx, player.grapple.ty);
        ctx.stroke();

        // Draw rubber stretch rings/folds
        ctx.strokeStyle = '#cc8060';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const segments = 6;
        for (let i = 1; i < segments; i++) {
            const ratio = i / segments;
            const rx = player.x + player.width / 2 + (player.grapple.tx - (player.x + player.width / 2)) * ratio;
            const ry = player.y + 10 + (player.grapple.ty - (player.y + 10)) * ratio;
            ctx.arc(rx, ry, 5, 0, Math.PI * 2);
        }
        ctx.stroke();

        // Hand grapple fist at hook end
        ctx.fillStyle = '#ff8866';
        ctx.fillRect(player.grapple.tx - 6, player.grapple.ty - 6, 12, 12);
    }

    // 7. Draw Luffy Player
    if (player.invulnerableFrames === 0 || Math.floor(player.invulnerableFrames / 3) % 2 === 0) {
        // Red vest
        ctx.fillStyle = varColor('--luffy-red');
        ctx.fillRect(player.x + 2, player.y + 10, player.width - 4, 12);
        
        // Blue shorts
        ctx.fillStyle = '#3388ff';
        ctx.fillRect(player.x + 2, player.y + 22, player.width - 4, 6);
        
        // Skin details (face, legs)
        ctx.fillStyle = '#ffc0a0';
        ctx.fillRect(player.x + 6, player.y + 4, player.width - 12, 6); // head
        ctx.fillRect(player.x + 4, player.y + 28, 4, 4); // left leg
        ctx.fillRect(player.x + player.width - 8, player.y + 28, 4, 4); // right leg
        
        // Straw Hat (yellow with red ribbon)
        ctx.fillStyle = varColor('--luffy-yellow');
        ctx.fillRect(player.x, player.y, player.width, 4); // brim
        ctx.fillRect(player.x + 4, player.y - 4, player.width - 8, 4); // crown
        ctx.fillStyle = varColor('--luffy-red');
        ctx.fillRect(player.x + 4, player.y, player.width - 8, 1.5); // ribbon
    }

    // 8. Draw Particles
    for (let p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0; // Reset alpha

    // 9. Draw Rising Water Layer (Blue Line Fountain)
    ctx.fillStyle = 'rgba(0, 255, 255, 0.45)'; // Wavy translucent cyan
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 4;
    
    // Wave drawing
    ctx.beginPath();
    const time = Date.now() * 0.005;
    ctx.moveTo(0, waterLevel);
    for (let x = 0; x <= canvas.width; x += 10) {
        const waveY = waterLevel + Math.sin(x * 0.03 + time) * 8;
        ctx.lineTo(x, waveY);
    }
    ctx.lineTo(canvas.width, canvas.height + cameraY + 200);
    ctx.lineTo(0, canvas.height + cameraY + 200);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

// Variable color helper for canvas context drawing
function varColor(variableName) {
    return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
}

// Game Over triggers
function triggerGameOver() {
    gameState = STATE_GAMEOVER;
    gameoverScreen.classList.add('active');
    finalHeight.textContent = heightVal.textContent;
    finalScore.textContent = score;
}

// Victory triggers
function triggerVictory() {
    gameState = STATE_VICTORY;
    victoryScreen.classList.add('active');
    victoryScore.textContent = score;
}

// Primary Animation Loop runner
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// Initialize and begin loops
startGame();
loop();
