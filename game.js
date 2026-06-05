function initGame() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
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
    const FRICTION = 0.88;
    const JUMP_FORCE = -10.0;
    const GROUND_Y = canvas.height - 40;
    const STRETCH_COST = 0.18;
    const ENERGY_REGEN = 0.5;

    // Game World Variables
    let score = 0;
    let highestHeight = 0;
    let cameraY = 0;
    let targetCameraY = 0;
    let maxLevelHeight = 4500; // Target height to win
    let screenShake = 0;

    // Player Object (Monkey D. Luffy)
    const player = {
        x: canvas.width / 2 - 14,
        y: GROUND_Y - 38,
        vx: 0,
        vy: 0,
        width: 28,
        height: 38,
        health: 100,
        maxHealth: 100,
        energy: 100,
        maxEnergy: 100,
        direction: 1, // 1 = right, -1 = left
        isGrounded: false,
        invulnerableFrames: 0,
        
        // Grappling hook (Gomu Gomu Arm) state
        grapple: {
            active: false,
            tx: 0,
            ty: 0,
            length: 0,
            maxLength: 300,
            k: 0.08, // Spring force
            damping: 0.95
        },

        // Animation states
        animationFrame: 0,
        animationTimer: 0
    };

    // Hazard: Rising Water level (Blue Line Fountain)
    let waterLevel = canvas.height + 100;
    let waterRiseSpeed = 0.65;
    let waterPulseTimer = 0;

    // Entity Arrays
    let platforms = [];
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

    // Tap / Click to grapple watchtowers in the upper half, or jump on the lower half
    canvas.addEventListener('mousedown', (e) => {
        if (gameState !== STATE_PLAYING) return;
        const rect = canvas.getBoundingClientRect();
        const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const clickY = (e.clientY - rect.top) * (canvas.height / rect.height) + cameraY;
        
        if (clickY > player.y + 20) {
            attemptJump();
        } else {
            attemptGrapple(clickX, clickY);
        }
    });

    canvas.addEventListener('touchstart', (e) => {
        if (gameState !== STATE_PLAYING) return;
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const clickX = (touch.clientX - rect.left) * (canvas.width / rect.width);
        const clickY = (touch.clientY - rect.top) * (canvas.height / rect.height) + cameraY;
        
        if (clickY > player.y + 20) {
            attemptJump();
        } else {
            attemptGrapple(clickX, clickY);
        }
        e.preventDefault();
    }, { passive: false });

    // UI Click Handlers
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', showIntroScreen);
    document.getElementById('win-restart-btn').addEventListener('click', showIntroScreen);

    // Setup mobile controls event binding
    function setupMobileControls() {
        const btnLeft = document.getElementById('btn-left');
        const btnRight = document.getElementById('btn-right');
        const btnUp = document.getElementById('btn-up');
        const btnDown = document.getElementById('btn-down');
        const btnPunch = document.getElementById('btn-punch');
        const btnJump = document.getElementById('btn-jump');

        if (!btnLeft) return;

        const preventDefault = (e) => {
            if (e.cancelable) e.preventDefault();
        };

        const bindButton = (btn, keyName, callbackOnPress) => {
            btn.addEventListener('touchstart', (e) => {
                preventDefault(e);
                keys[keyName] = true;
                if (callbackOnPress) callbackOnPress();
            }, { passive: false });

            btn.addEventListener('touchend', (e) => {
                preventDefault(e);
                keys[keyName] = false;
            }, { passive: false });

            btn.addEventListener('touchcancel', (e) => {
                preventDefault(e);
                keys[keyName] = false;
            }, { passive: false });
        };

        bindButton(btnLeft, 'a');
        bindButton(btnRight, 'd');
        bindButton(btnUp, 'w', () => {
            attemptJump();
        });
        bindButton(btnDown, 's');
        bindButton(btnPunch, 'space', () => {
            shootProjectile();
        });
        bindButton(btnJump, 'w', () => {
            attemptJump();
        });
    }

    function showIntroScreen() {
        gameState = STATE_INTRO;
        introScreen.classList.add('active');
        gameoverScreen.classList.remove('active');
        victoryScreen.classList.remove('active');
        
        // Setup initial background visual platforms
        score = 0;
        cameraY = 0;
        targetCameraY = 0;
        waterLevel = canvas.height + 100;
        generateLevelPreview();
    }

    function startGame() {
        introScreen.classList.remove('active');
        gameoverScreen.classList.remove('active');
        victoryScreen.classList.remove('active');

        // Reset Player stats
        player.x = canvas.width / 2 - 14;
        player.y = GROUND_Y - 40;
        player.vx = 0;
        player.vy = 0;
        player.health = 100;
        player.energy = 100;
        player.grapple.active = false;

        // Reset World stats
        score = 0;
        highestHeight = 0;
        cameraY = 0;
        targetCameraY = 0;
        screenShake = 0;
        waterLevel = canvas.height + 150;
        waterRiseSpeed = 0.65;
        waterPulseTimer = 0;

        platforms = [];
        enemies = [];
        playerProjectiles = [];
        enemyProjectiles = [];
        particles = [];

        // Generate full vertical level climb
        generateLevel();

        gameState = STATE_PLAYING;
    }

    // Generate vertical structures climb
    function generateLevel() {
        platforms = [];
        enemies = [];

        // Ground platform
        platforms.push({
            x: 0,
            y: GROUND_Y,
            width: canvas.width,
            height: 60,
            type: 'ground',
            color: '#1c2530'
        });

        // Procedurally stack watchtowers and decks upwards
        let currentY = GROUND_Y - 140;
        while (currentY > -maxLevelHeight) {
            const numTowers = 2 + Math.floor(Math.random() * 2);
            
            for (let i = 0; i < numTowers; i++) {
                const towerX = 50 + (i * (canvas.width - 160) / (numTowers - 1)) + (Math.random() - 0.5) * 40;
                const towerWidth = 60 + Math.random() * 30;
                const towerHeight = 110 + Math.random() * 50;

                // Watchtower column
                platforms.push({
                    x: towerX,
                    y: currentY,
                    width: towerWidth,
                    height: towerHeight,
                    type: 'watchtower',
                    color: '#3e2723' // Wood brown
                });

                // Node lantern for grappling at top center of tower
                platforms.push({
                    x: towerX + (towerWidth / 2) - 5,
                    y: currentY - 18,
                    width: 10,
                    height: 10,
                    type: 'grapple-node',
                    color: '#ffcc00'
                });

                // Spawn Marine Guard patrolling the deck
                if (Math.random() < 0.45 && currentY < GROUND_Y - 300) {
                    enemies.push({
                        x: towerX + 10,
                        y: currentY - 32,
                        width: 20,
                        height: 32,
                        patrolMin: towerX + 2,
                        patrolMax: towerX + towerWidth - 22,
                        vx: 0.7 + Math.random() * 0.5,
                        direction: 1,
                        health: 22,
                        maxHealth: 22,
                        shootCooldown: 80 + Math.random() * 80,
                        type: 'guard'
                    });
                }
            }

            // Floating intermediate cloud decks or spike barriers
            if (Math.random() < 0.4) {
                const cloudX = Math.random() * (canvas.width - 120);
                platforms.push({
                    x: cloudX,
                    y: currentY + 60,
                    width: 100,
                    height: 15,
                    type: 'cloud-platform',
                    color: '#8395a7'
                });
            }

            currentY -= 200; // Step height increments upwards
        }

        // Final Boss platform at the top
        const bossPlatformY = -maxLevelHeight;
        platforms.push({
            x: 100,
            y: bossPlatformY,
            width: canvas.width - 200,
            height: 25,
            type: 'boss-platform',
            color: '#4f5d75'
        });

        // Spawn Captain Smoker Boss
        enemies.push({
            x: canvas.width / 2 - 18,
            y: bossPlatformY - 60,
            width: 36,
            height: 60,
            patrolMin: 120,
            patrolMax: canvas.width - 160,
            vx: 1.3,
            direction: 1,
            health: 280,
            maxHealth: 280,
            shootCooldown: 70,
            type: 'boss'
        });
    }

    // Preview generation
    function generateLevelPreview() {
        platforms = [{ x: 0, y: GROUND_Y, width: canvas.width, height: 60, type: 'ground', color: '#1c2530' }];
        enemies = [];
    }

    // Jump mechanic
    function attemptJump() {
        if (player.isGrounded) {
            player.vy = JUMP_FORCE;
            player.isGrounded = false;
            createSparks(player.x + player.width/2, player.y + player.height, '#ffffff', 4);
        }
    }

    // Grapple hook execution
    function attemptGrapple(clickX, clickY) {
        if (player.energy < 15) return;

        // Search for node
        for (let p of platforms) {
            if (p.type === 'grapple-node' || p.type === 'cloud-platform' || p.type === 'boss-platform') {
                const px = p.x + (p.width / 2);
                const py = p.y;

                if (clickX >= p.x - 25 && clickX <= p.x + p.width + 25 &&
                    clickY >= p.y - 25 && clickY <= p.y + p.height + 25) {
                    
                    const dx = px - player.x;
                    const dy = py - player.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist <= player.grapple.maxLength) {
                        player.grapple.active = true;
                        player.grapple.tx = px;
                        player.grapple.ty = py;
                        player.grapple.length = dist * 0.8; // Elastic tension factor
                        
                        player.energy -= 15;
                        createSparks(px, py, '#ffcc00', 8);
                        break;
                    }
                }
            }
        }
    }

    // Giant Gear Third ranged projectile
    function shootProjectile() {
        if (gameState !== STATE_PLAYING) return;
        if (player.energy < 25) return;

        player.energy -= 25;
        playerProjectiles.push({
            x: player.x + (player.direction === 1 ? player.width : -16),
            y: player.y + 10,
            vx: player.direction * 9.0,
            vy: 0,
            width: 16,
            height: 16,
            damage: 20,
            type: 'fist'
        });

        createSparks(player.x + (player.direction === 1 ? player.width : 0), player.y + 15, '#ff3344', 4);
    }

    // Damage player
    function damagePlayer(amt) {
        if (player.invulnerableFrames > 0) return;
        player.health = Math.max(0, player.health - amt);
        player.invulnerableFrames = 30;
        screenShake = 10;
        createSparks(player.x + player.width/2, player.y + player.height/2, '#ff3344', 12);
    }

    // Spark particles helper
    function createSparks(x, y, color, count = 6) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5 - 1.5,
                radius: 2 + Math.random() * 3,
                color: color,
                alpha: 1,
                decay: 0.02 + Math.random() * 0.03
            });
        }
    }

    // Main physics updates
    function update() {
        if (gameState !== STATE_PLAYING) return;

        if (screenShake > 0.1) screenShake *= 0.9;
        if (player.invulnerableFrames > 0) player.invulnerableFrames--;

        // Horizontal Keyboard movement controls
        if (keys.d || keys.ArrowRight) {
            player.vx = 4.0;
            player.direction = 1;
            player.animationTimer++;
            if (player.animationTimer > 6) {
                player.animationFrame = (player.animationFrame + 1) % 4;
                player.animationTimer = 0;
            }
        } else if (keys.a || keys.ArrowLeft) {
            player.vx = -4.0;
            player.direction = -1;
            player.animationTimer++;
            if (player.animationTimer > 6) {
                player.animationFrame = (player.animationFrame + 1) % 4;
                player.animationTimer = 0;
            }
        } else {
            player.vx *= FRICTION; // Slide decay
            player.animationFrame = 0; // Standing/Idle frame
        }

        // Grapple elastic joint physics
        if (player.grapple.active) {
            const dx = player.grapple.tx - player.x;
            const dy = player.grapple.ty - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            player.energy = Math.max(0, player.energy - STRETCH_COST);
            if (player.energy <= 0) {
                player.grapple.active = false;
            }

            // Grapple length adjustment W/S
            if (keys.w || keys.ArrowUp) player.grapple.length = Math.max(30, player.grapple.length - 3.5);
            if (keys.s || keys.ArrowDown) player.grapple.length = Math.min(player.grapple.maxLength, player.grapple.length + 3.5);

            // Pull math
            if (dist > player.grapple.length) {
                const stretch = dist - player.grapple.length;
                const force = stretch * player.grapple.k;
                player.vx += (dx / dist) * force;
                player.vy += (dy / dist) * force;
            }

            // Release grapple if climbing past grapple anchor height
            if (player.y < player.grapple.ty + 8) {
                player.grapple.active = false;
                player.vy = -3.5; // slight boost upwards
            }
        } else {
            player.energy = Math.min(player.maxEnergy, player.energy + ENERGY_REGEN);
        }

        // Apply velocities
        player.vy += GRAVITY;
        player.x += player.vx;
        player.y += player.vy;

        // Sideways boundaries
        if (player.x < 10) {
            player.x = 10;
            player.vx = 0;
        }
        if (player.x + player.width > canvas.width - 10) {
            player.x = canvas.width - 10 - player.width;
            player.vx = 0;
        }

        // Rising water deluge logic (rises from bottom)
        waterPulseTimer++;
        if (waterPulseTimer > 350) {
            waterPulseTimer = 0;
            waterLevel -= 55; // volcanic burst surge upwards
            createSparks(canvas.width / 2, waterLevel, '#ffffff', 20);
        }
        
        // Steady water rise (speeds up as player climbs higher)
        const altitudeMultiplier = Math.max(1, Math.floor(Math.abs(player.y) / 1000));
        waterLevel -= waterRiseSpeed * altitudeMultiplier;

        // Submersion check
        if (player.y + player.height > waterLevel) {
            damagePlayer(0.8);
            if (Math.random() < 0.2) {
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

        if (player.health <= 0) {
            triggerGameOver();
        }

        // Platforms collisions (Ground, Watchtowers, Cloud Decks)
        player.isGrounded = false;
        for (let p of platforms) {
            if (player.vx + player.x + player.width > p.x &&
                player.x < p.x + p.width &&
                player.y + player.height >= p.y &&
                player.y + player.height - player.vy <= p.y + 10) {
                
                player.y = p.y - player.height;
                player.vy = 0;
                player.isGrounded = true;
            }
        }

        // Player Projectiles
        for (let i = playerProjectiles.length - 1; i >= 0; i--) {
            const proj = playerProjectiles[i];
            proj.x += proj.vx;

            if (proj.x < 0 || proj.x > canvas.width) {
                playerProjectiles.splice(i, 1);
                continue;
            }

            for (let enemy of enemies) {
                if (proj.x + proj.width >= enemy.x && proj.x <= enemy.x + enemy.width &&
                    proj.y + proj.height >= enemy.y && proj.y <= enemy.y + enemy.height) {
                    
                    enemy.health -= proj.damage;
                    createSparks(proj.x, proj.y, '#ffcc00', 8);
                    playerProjectiles.splice(i, 1);
                    score += 50;

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

        // Enemies update
        for (let enemy of enemies) {
            enemy.x += enemy.vx * enemy.direction;
            if (enemy.x <= enemy.patrolMin) enemy.direction = 1;
            if (enemy.x + enemy.width >= enemy.patrolMax) enemy.direction = -1;

            enemy.shootCooldown--;
            if (enemy.shootCooldown <= 0) {
                enemy.shootCooldown = enemy.type === 'boss' ? 75 : 120 + Math.random() * 80;
                
                // Shoot projectile towards Luffy
                const dx = player.x - enemy.x;
                const dy = player.y - enemy.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 450) {
                    const angle = Math.atan2(dy, dx);
                    enemyProjectiles.push({
                        x: enemy.x + enemy.width/2,
                        y: enemy.y + 12,
                        vx: Math.cos(angle) * (enemy.type === 'boss' ? 5.5 : 4.0),
                        vy: Math.sin(angle) * (enemy.type === 'boss' ? 5.5 : 4.0),
                        width: enemy.type === 'boss' ? 24 : 6,
                        height: enemy.type === 'boss' ? 14 : 6,
                        damage: enemy.type === 'boss' ? 18 : 10,
                        type: enemy.type === 'boss' ? 'smoke' : 'bullet'
                    });
                }
            }

            // Body contact damage
            if (player.x + player.width >= enemy.x && player.x <= enemy.x + enemy.width &&
                player.y + player.height >= enemy.y && player.y <= enemy.y + enemy.height) {
                damagePlayer(enemy.type === 'boss' ? 20 : 12);
            }
        }

        // Process Enemy Projectiles
        for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
            const proj = enemyProjectiles[i];
            proj.x += proj.vx;
            proj.y += proj.vy;

            // boundaries check
            if (proj.x < 0 || proj.x > canvas.width || proj.y < cameraY || proj.y > cameraY + canvas.height) {
                enemyProjectiles.splice(i, 1);
                continue;
            }

            if (proj.x + proj.width >= player.x && proj.x <= player.x + player.width &&
                proj.y + proj.height >= player.y && proj.y <= player.y + player.height) {
                
                damagePlayer(proj.damage);
                createSparks(proj.x, proj.y, proj.type === 'smoke' ? '#d1d8e0' : '#ffffff', 8);
                enemyProjectiles.splice(i, 1);
            }
        }

        // Update Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;
            if (p.alpha <= 0) particles.splice(i, 1);
        }

        // Camera Tracking Y (Smooth Y scroll centering player, camera never scrolls down)
        targetCameraY = player.y - canvas.height / 2 + 50;
        if (targetCameraY < cameraY) {
            cameraY += (targetCameraY - cameraY) * 0.12;
        }

        // Height score metrics
        const currentHeight = Math.max(0, Math.floor((GROUND_Y - player.height - player.y) / 10));
        if (currentHeight > highestHeight) {
            highestHeight = currentHeight;
            score += (currentHeight - highestHeight) * 10;
        }

        updateHUD(currentHeight);
    }

    // Update HUD
    function updateHUD(h) {
        healthBar.style.width = `${player.health}%`;
        energyBar.style.width = `${player.energy}%`;
        heightVal.textContent = `${h}m`;
        scoreVal.textContent = score;
    }

    // Draw Luffy Pixel Art Sprite (tilted running or idle frames)
    function drawLuffy(ctx, px, py) {
        const timeFrame = player.animationFrame; // 0 to 3 running animation cycle
        const isRunning = Math.abs(player.vx) > 0.5;

        ctx.save();
        // Translate center of player body
        ctx.translate(px + player.width / 2, py + player.height / 2);
        
        // Flip direction scale
        ctx.scale(player.direction, 1);

        // Tilt body if running
        if (isRunning) {
            ctx.rotate(0.12);
        }

        // Draw Straw Hat
        ctx.fillStyle = '#eedb52'; // Straw yellow
        ctx.fillRect(-12, -22, 24, 4); // Brim
        ctx.fillRect(-7, -27, 14, 5); // Crown
        ctx.fillStyle = '#ff3344'; // Ribbon
        ctx.fillRect(-7, -23, 14, 2);

        // Head / Skin Face
        ctx.fillStyle = '#ffccaa';
        ctx.fillRect(-6, -18, 12, 8);
        
        // Dark brown hair / grin
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(-7, -18, 2, 8); // hair back
        ctx.fillRect(4, -14, 2, 2); // eye
        ctx.fillRect(-4, -10, 8, 2); // grin

        // Red Vest
        ctx.fillStyle = '#ff3344';
        ctx.fillRect(-8, -10, 16, 11);
        ctx.fillStyle = '#ffeedd'; // Vest open chest skin
        ctx.fillRect(-2, -10, 4, 6);

        // Blue Shorts
        ctx.fillStyle = '#3a86c8';
        ctx.fillRect(-8, 1, 16, 8);

        // Legs run-cycle frames
        ctx.fillStyle = '#ffccaa';
        if (player.isGrounded) {
            if (isRunning) {
                if (timeFrame === 0) {
                    ctx.fillRect(2, 9, 5, 8); // Left Leg forward
                    ctx.fillRect(-8, 9, 4, 8); // Right Leg back
                    ctx.fillRect(-10, 15, 4, 2);
                } else if (timeFrame === 1 || timeFrame === 3) {
                    ctx.fillRect(-4, 9, 4, 8); // Passing
                    ctx.fillRect(0, 9, 4, 8);
                } else if (timeFrame === 2) {
                    ctx.fillRect(-7, 9, 5, 8); // Right Leg forward
                    ctx.fillRect(3, 9, 4, 8); // Left Leg back
                    ctx.fillRect(5, 15, 4, 2);
                }
            } else {
                // Standing Idle Stance
                ctx.fillRect(-5, 9, 4, 8);
                ctx.fillRect(1, 9, 4, 8);
                ctx.fillRect(-7, 15, 3, 2);
                ctx.fillRect(1, 15, 3, 2);
            }
        } else {
            // Jumping/Grappling midair frame
            ctx.fillRect(-6, 9, 4, 6);
            ctx.fillRect(2, 9, 4, 8);
            ctx.fillRect(4, 15, 4, 2);
        }

        // Arms
        ctx.fillStyle = '#ffccaa';
        if (player.grapple.active) {
            // Hand stretching up - handled in grapple line rendering
        } else {
            if (isRunning) {
                if (timeFrame === 0 || timeFrame === 2) {
                    ctx.fillRect(-11, -8, 3, 7); // Back arm swing
                    ctx.fillRect(8, -6, 4, 4); // Front hand
                } else {
                    ctx.fillRect(8, -8, 3, 7);
                    ctx.fillRect(-11, -6, 4, 4);
                }
            } else {
                // Idle arms hanging down
                ctx.fillRect(-10, -8, 3, 10);
                ctx.fillRect(7, -8, 3, 10);
            }
        }

        ctx.restore();
    }

    // Render screen
    function draw() {
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
        // Translate for Y vertical scroll camera
        ctx.translate(0, -cameraY);

        // 1. Parallax background walls/decorations
        ctx.fillStyle = '#161d28';
        for (let i = Math.floor(cameraY / 200) * 200 - 200; i < cameraY + canvas.height + 200; i += 200) {
            ctx.fillRect(15, i, 4, 120);
            ctx.fillRect(canvas.width - 19, i + 80, 4, 120);
        }

        // 2. Draw Ground and Platforms (Watchtowers/Cloud Decks)
        for (let p of platforms) {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.width, p.height);

            // Lighting caps/cracks
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.fillRect(p.x, p.y, p.width, 3);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(p.x, p.y + p.height - 4, p.width, 4);

            if (p.type === 'watchtower') {
                // Draw cross column bars
                ctx.strokeStyle = '#281715';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(p.x + 12, p.y + 4);
                ctx.lineTo(p.x + p.width - 12, p.y + p.height);
                ctx.moveTo(p.x + p.width - 12, p.y + 4);
                ctx.lineTo(p.x + 12, p.y + p.height);
                ctx.stroke();

                // Deck guard rails
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(p.x - 5, p.y - 12, p.width + 10, 4);
            }
        }

        // 3. Draw Enemies (One Piece Marine Uniforms)
        for (let enemy of enemies) {
            if (enemy.type === 'boss') {
                // Draw Smoker floating on smoke
                ctx.fillStyle = '#d1d8e0'; // smoke body bottom
                ctx.fillRect(enemy.x - 5, enemy.y + enemy.height - 22, enemy.width + 10, 22);
                ctx.fillStyle = '#4f5d75'; // Blue double coat
                ctx.fillRect(enemy.x, enemy.y + 8, enemy.width, enemy.height - 26);
                ctx.fillStyle = '#ffffff'; // White hair
                ctx.fillRect(enemy.x + 8, enemy.y - 8, enemy.width - 16, 8);
                ctx.fillStyle = '#ffccaa'; // Face
                ctx.fillRect(enemy.x + 6, enemy.y, enemy.width - 12, 8);
                
                // Jitte stick
                ctx.strokeStyle = '#7f8c8d';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(enemy.x + enemy.width, enemy.y + 15);
                ctx.lineTo(enemy.x + enemy.width + 10, enemy.y - 12);
                ctx.stroke();
            } else {
                // Patrolling Guard
                ctx.fillStyle = '#ffffff'; // Shirt white
                ctx.fillRect(enemy.x, enemy.y + 8, enemy.width, enemy.height - 20);
                ctx.fillStyle = '#0f2042'; // Blue pants
                ctx.fillRect(enemy.x, enemy.y + enemy.height - 12, enemy.width, 12);
                ctx.fillStyle = '#ffffff'; // Cap
                ctx.fillRect(enemy.x + 2, enemy.y - 6, enemy.width - 4, 6);
                ctx.fillStyle = '#0f2042'; // Visor
                ctx.fillRect(enemy.x + (enemy.direction === 1 ? enemy.width - 5 : 0), enemy.y - 2, 5, 2);
            }

            // Enemy health display
            if (enemy.health < enemy.maxHealth) {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(enemy.x - 5, enemy.y - 16, enemy.width + 10, 4);
                ctx.fillStyle = '#ff3344';
                ctx.fillRect(enemy.x - 5, enemy.y - 16, (enemy.width + 10) * (enemy.health / enemy.maxHealth), 4);
            }
        }

        // 4. Draw Player Projectiles (Gomu Gomu punches)
        ctx.fillStyle = '#ffaa99';
        for (let proj of playerProjectiles) {
            ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
            
            // Connect stretched Gomu arm line from player to projectile
            ctx.strokeStyle = '#ffccaa';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(player.x + player.width/2, player.y + 15);
            ctx.lineTo(proj.x + proj.width/2, proj.y + proj.height/2);
            ctx.stroke();
        }

        // 5. Draw Enemy Projectiles
        for (let proj of enemyProjectiles) {
            if (proj.type === 'smoke') {
                ctx.fillStyle = 'rgba(209, 216, 224, 0.7)'; // trans smoke plume
                ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
            } else {
                ctx.fillStyle = '#ffd152'; // sniper bullet
                ctx.beginPath();
                ctx.arc(proj.x + 3, proj.y + 3, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 6. Draw Grappling Arm (Dehnbarer Gummikörper)
        if (player.grapple.active) {
            ctx.strokeStyle = '#ffccaa';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(player.x + player.width / 2, player.y + 10);
            ctx.lineTo(player.grapple.tx, player.grapple.ty);
            ctx.stroke();

            // Grapple fist hand
            ctx.fillStyle = '#ff8866';
            ctx.fillRect(player.grapple.tx - 6, player.grapple.ty - 6, 12, 12);
        }

        // 7. Draw Luffy Player
        if (player.invulnerableFrames === 0 || Math.floor(player.invulnerableFrames / 3) % 2 === 0) {
            drawLuffy(ctx, player.x, player.y);
        }

        // 8. Draw Particles system
        for (let p of particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // 9. Draw Rising Water Deluge (From the bottom)
        ctx.fillStyle = 'rgba(0, 255, 255, 0.45)';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 4;

        ctx.beginPath();
        const waveTime = Date.now() * 0.005;
        ctx.moveTo(0, waterLevel);
        for (let x = 0; x <= canvas.width; x += 15) {
            const waveY = waterLevel + Math.sin(x * 0.035 + waveTime) * 6;
            ctx.lineTo(x, waveY);
        }
        ctx.lineTo(canvas.width, canvas.height + cameraY + 200);
        ctx.lineTo(0, canvas.height + cameraY + 200);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore(); // cameraY
        ctx.restore(); // screenShake
    }

    // GameOver trigger
    function triggerGameOver() {
        gameState = STATE_GAMEOVER;
        gameoverScreen.classList.add('active');
        finalHeight.textContent = heightVal.textContent;
        finalScore.textContent = score;
    }

    // Victory trigger
    function triggerVictory() {
        gameState = STATE_VICTORY;
        victoryScreen.classList.add('active');
        victoryScore.textContent = score;
    }

    // Primary loop
    function loop() {
        update();
        draw();
        requestAnimationFrame(loop);
    }

    // Initialize and run game loop!
    setupMobileControls();
    showIntroScreen();
    loop();
}

// Safe DOM Bootstrapping
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initGame();
} else {
    document.addEventListener('DOMContentLoaded', initGame);
}
