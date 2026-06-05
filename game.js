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
    const GROUND_Y = canvas.height - 60; // Ground platform height
    const STRETCH_COST = 0.18;
    const ENERGY_REGEN = 0.5;

    // Game World Variables
    let score = 0;
    let highestHeight = 0; // Tracks highest distance (X coordinate)
    let cameraX = 0;
    let targetCameraX = 0;
    let maxLevelHeight = 30000; // Total horizontal length of level (3000m)
    let screenShake = 0;

    // Player Object (Monkey D. Luffy)
    const player = {
        x: 100,
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
            maxLength: 320,
            k: 0.08, // Spring force constant
            damping: 0.95
        },

        // Animation states
        animationFrame: 0,
        animationTimer: 0
    };

    // Hazard: Chasing Tsunami (deluge from the left)
    let tsunamiX = -300;
    let tsunamiBaseSpeed = 3.3;

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
        
        // Prevent default actions for control keys (scrolling, spacebar triggering focused buttons)
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key) || e.key === ' ') {
            e.preventDefault();
        }

        // Blur any focused UI button to prevent Spacebar from triggering a click event on it
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }

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

    // Tap / Click on watchtowers / upper area to grapple, lower area to jump
    canvas.addEventListener('mousedown', (e) => {
        if (gameState !== STATE_PLAYING) return;
        const rect = canvas.getBoundingClientRect();
        const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);
        
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
        const clickY = (touch.clientY - rect.top) * (canvas.height / rect.height);
        
        if (clickY > player.y + 20) {
            attemptJump();
        } else {
            attemptGrapple(clickX, clickY);
        }
        e.preventDefault();
    }, { passive: false });

    // UI Click Handlers
    document.getElementById('start-btn').addEventListener('click', (e) => {
        e.target.blur();
        startGame();
    });
    document.getElementById('restart-btn').addEventListener('click', (e) => {
        e.target.blur();
        showIntroScreen();
    });
    document.getElementById('win-restart-btn').addEventListener('click', (e) => {
        e.target.blur();
        showIntroScreen();
    });

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
        
        score = 0;
        cameraX = 0;
        targetCameraX = 0;
        tsunamiX = -300;
        generateLevelPreview();
    }

    function startGame() {
        introScreen.classList.remove('active');
        gameoverScreen.classList.remove('active');
        victoryScreen.classList.remove('active');

        // Reset Player stats
        player.x = 100;
        player.y = GROUND_Y - 40;
        player.vx = 4.0; // Starts running
        player.vy = 0;
        player.health = 100;
        player.energy = 100;
        player.grapple.active = false;

        // Reset World stats
        score = 0;
        highestHeight = 0;
        cameraX = 0;
        targetCameraX = 0;
        screenShake = 0;
        tsunamiX = -300;

        platforms = [];
        enemies = [];
        playerProjectiles = [];
        enemyProjectiles = [];
        particles = [];

        // Generate full horizontal runner level
        generateLevel();

        gameState = STATE_PLAYING;
    }

    // Generate horizontal level design with zero dead-ends
    function generateLevel() {
        platforms = [];
        enemies = [];

        let currentX = 0;
        const chasmChance = 0.16;
        const obstacleChance = 0.48;

        // Ground start segment
        platforms.push({
            x: 0,
            y: GROUND_Y,
            width: 1200,
            height: 60,
            type: 'ground',
            color: '#1c2530'
        });
        currentX = 1200;

        while (currentX < maxLevelHeight) {
            // Spawning chasm (water pit)
            if (Math.random() < chasmChance && currentX < maxLevelHeight - 2000) {
                const chasmWidth = 120; // 120px is easily jumpable at high speeds or grappleable
                
                // Spawn a cloud deck above the chasm to serve as a grapple point
                const cloudX = currentX + chasmWidth / 2 - 50;
                const cloudY = GROUND_Y - 140;
                platforms.push({
                    x: cloudX,
                    y: cloudY,
                    width: 100,
                    height: 15,
                    type: 'cloud-platform',
                    color: '#8395a7'
                });

                // Spawn a grapple node center top of cloud
                platforms.push({
                    x: cloudX + 45,
                    y: cloudY - 18,
                    width: 10,
                    height: 10,
                    type: 'grapple-node',
                    color: '#ffcc00'
                });

                currentX += chasmWidth;
            } else {
                // Spawn normal ground segment
                const segmentWidth = 400 + Math.floor(Math.random() * 400);
                platforms.push({
                    x: currentX,
                    y: GROUND_Y,
                    width: segmentWidth,
                    height: 60,
                    type: 'ground',
                    color: '#1c2530'
                });

                // Spawn procedural obstacles ON this ground segment
                let spawnOffset = 150;
                while (spawnOffset < segmentWidth - 150) {
                    const obstacleX = currentX + spawnOffset;

                    if (Math.random() < obstacleChance) {
                        const roll = Math.random();
                        if (roll < 0.45) {
                            // Low Barricade (easily jumpable, height 32px)
                            platforms.push({
                                x: obstacleX,
                                y: GROUND_Y - 32,
                                width: 28,
                                height: 32,
                                type: 'barricade',
                                color: '#5d4037'
                            });
                        } else if (roll < 0.85) {
                            // Marine Watchtower (requires grapple or cloud jump, height 160px)
                            const towerWidth = 64;
                            const towerHeight = 160;

                            platforms.push({
                                x: obstacleX,
                                y: GROUND_Y - towerHeight,
                                width: towerWidth,
                                height: towerHeight,
                                type: 'watchtower',
                                color: '#3e2723'
                            });

                            // Node lantern for grapple on top center
                            platforms.push({
                                x: obstacleX + (towerWidth / 2) - 5,
                                y: GROUND_Y - towerHeight - 18,
                                width: 10,
                                height: 10,
                                type: 'grapple-node',
                                color: '#ffcc00'
                            });

                            // Spawn floating cloud platform step before the tower to ensure it can always be crossed
                            platforms.push({
                                x: obstacleX - 80,
                                y: GROUND_Y - 80,
                                width: 45,
                                height: 10,
                                type: 'cloud-platform',
                                color: '#8395a7'
                            });

                            // Spawn Marine Guard patrolling tower deck
                            if (Math.random() < 0.5) {
                                enemies.push({
                                    x: obstacleX + 10,
                                    y: GROUND_Y - towerHeight - 32,
                                    width: 20,
                                    height: 32,
                                    patrolMin: obstacleX + 2,
                                    patrolMax: obstacleX + towerWidth - 22,
                                    vx: 0.6,
                                    direction: 1,
                                    health: 22,
                                    maxHealth: 22,
                                    shootCooldown: 80 + Math.random() * 80,
                                    type: 'guard'
                                });
                            }
                        } else {
                            // Ground Spikes (jumpable, height 12px)
                            platforms.push({
                                x: obstacleX,
                                y: GROUND_Y - 12,
                                width: 50,
                                height: 12,
                                type: 'spikes',
                                color: '#7f8c8d'
                            });
                        }

                        spawnOffset += 240; // Spacing increment
                    } else {
                        spawnOffset += 100;
                    }
                }

                // Patrolling Guard on ground level
                if (Math.random() < 0.4) {
                    enemies.push({
                       x: currentX + segmentWidth / 2,
                       y: GROUND_Y - 32,
                       width: 20,
                       health: 22,
                       maxHealth: 22,
                       patrolMin: currentX + 40,
                       patrolMax: currentX + segmentWidth - 40,
                       vx: 0.7,
                       direction: 1,
                       shootCooldown: 90 + Math.random() * 80,
                       type: 'guard'
                    });
                }

                currentX += segmentWidth;
            }
        }

        // Final Boss platform at maxLevelHeight
        platforms.push({
            x: maxLevelHeight,
            y: GROUND_Y,
            width: 1200,
            height: 60,
            type: 'boss-platform',
            color: '#4f5d75'
        });

        // Spawn Captain Smoker Boss
        enemies.push({
            x: maxLevelHeight + 350,
            y: GROUND_Y - 60,
            width: 36,
            height: 60,
            patrolMin: maxLevelHeight + 150,
            patrolMax: maxLevelHeight + 800,
            vx: 1.2,
            direction: 1,
            health: 280,
            maxHealth: 280,
            shootCooldown: 60,
            type: 'boss'
        });
    }

    // Preview level generation
    function generateLevelPreview() {
        platforms = [{ x: 0, y: GROUND_Y, width: canvas.width, height: 60, type: 'ground', color: '#1c2530' }];
        enemies = [];
    }

    // Jump mechanic
    function attemptJump() {
        if (player.grapple.active) {
            // Pressing W/Jump while grappled cuts rope and launches Luffy up
            player.grapple.active = false;
            player.vy = -6.0;
            createSparks(player.x, player.y, '#ffffff', 4);
        } else if (player.isGrounded) {
            player.vy = JUMP_FORCE;
            player.isGrounded = false;
            createSparks(player.x + player.width/2, player.y + player.height, '#ffffff', 4);
        }
    }

    // Grapple hook execution
    function attemptGrapple(clickX, clickY) {
        if (player.energy < 15) return;

        // Convert screen clickX to absolute X coordinate based on camera scroll
        const absoluteClickX = clickX + cameraX;

        // Search for hook node
        for (let p of platforms) {
            if (p.type === 'grapple-node' || p.type === 'cloud-platform' || p.type === 'boss-platform') {
                const px = p.x + (p.width / 2);
                const py = p.y;

                if (absoluteClickX >= p.x - 25 && absoluteClickX <= p.x + p.width + 25 &&
                    clickY >= p.y - 25 && clickY <= p.y + p.height + 25) {
                    
                    const dx = px - player.x;
                    const dy = py - player.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist <= player.grapple.maxLength) {
                        player.grapple.active = true;
                        player.grapple.tx = px;
                        player.grapple.ty = py;
                        player.grapple.length = dist * 0.8; // Elastic spring rest-length
                        
                        player.energy -= 15;
                        createSparks(px, py, '#ffcc00', 8);
                        break;
                    }
                }
            }
        }
    }

    // Giant Gear Third ranged punch
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

        // Horizontal Movement logic (Auto-run default, key steering modifiers)
        const baseRunSpeed = 3.5;
        if (keys.d || keys.ArrowRight) {
            player.vx = Math.min(5.8, player.vx + 0.15);
            player.direction = 1;
            player.animationTimer++;
            if (player.animationTimer > 5) {
                player.animationFrame = (player.animationFrame + 1) % 4;
                player.animationTimer = 0;
            }
        } else if (keys.a || keys.ArrowLeft) {
            player.vx = Math.max(1.5, player.vx - 0.15);
            player.direction = -1;
            player.animationTimer++;
            if (player.animationTimer > 5) {
                player.animationFrame = (player.animationFrame + 1) % 4;
                player.animationTimer = 0;
            }
        } else {
            // Auto run centering
            if (player.vx < baseRunSpeed) player.vx = Math.min(baseRunSpeed, player.vx + 0.1);
            if (player.vx > baseRunSpeed) player.vx = Math.max(baseRunSpeed, player.vx - 0.1);
            player.direction = 1;
            player.animationTimer++;
            if (player.animationTimer > 6) {
                player.animationFrame = (player.animationFrame + 1) % 4;
                player.animationTimer = 0;
            }
        }

        // Grapple elastic joints spring physics
        if (player.grapple.active) {
            const dx = player.grapple.tx - player.x;
            const dy = player.grapple.ty - player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            player.energy = Math.max(0, player.energy - STRETCH_COST);
            if (player.energy <= 0) {
                player.grapple.active = false;
            }

            // Grapple length adjustment W/S keys
            if (keys.w || keys.ArrowUp) player.grapple.length = Math.max(30, player.grapple.length - 3.5);
            if (keys.s || keys.ArrowDown) player.grapple.length = Math.min(player.grapple.maxLength, player.grapple.length + 3.5);

            // Apply pull physics
            if (dist > player.grapple.length) {
                const stretch = dist - player.grapple.length;
                const force = stretch * player.grapple.k;
                player.vx += (dx / dist) * force;
                player.vy += (dy / dist) * force;
            }

            // Grapple automatically releases if player gets very close or swings past
            if (dist < 20 || player.y < player.grapple.ty - 10) {
                player.grapple.active = false;
                player.vy = -3.0; // minor boost
            }
        } else {
            player.energy = Math.min(player.maxEnergy, player.energy + ENERGY_REGEN);
        }

        // Apply physical velocities
        player.vy += GRAVITY;
        player.x += player.vx;
        player.y += player.vy;

        // Left boundary clamp
        if (player.x < 10) {
            player.x = 10;
            player.vx = 0;
        }

        // Chasing Tsunami math (rubber-banding based on player distance)
        const distanceToWave = player.x - tsunamiX;
        let tsunamiSpeed = tsunamiBaseSpeed;
        if (distanceToWave > 380) {
            tsunamiSpeed = Math.min(6.5, tsunamiSpeed + (distanceToWave - 380) * 0.015);
        } else if (distanceToWave < 120) {
            tsunamiSpeed = Math.max(1.8, tsunamiSpeed - (120 - distanceToWave) * 0.05);
        }
        tsunamiX += tsunamiSpeed;

        // Submersion inside tsunami wave
        if (player.x < tsunamiX + 15) {
            damagePlayer(0.9);
            player.x = tsunamiX + 15; // push player forward
            if (player.vx < 1.0) player.vx = 2.0;

            if (Math.random() < 0.2) {
                particles.push({
                    x: player.x + Math.random() * player.width,
                    y: player.y + player.height/2,
                    vx: -2.0 + Math.random() * 2,
                    vy: -Math.random() * 3,
                    radius: 3 + Math.random() * 3,
                    color: '#e0ffff',
                    alpha: 0.8,
                    decay: 0.02
                });
            }
        }

        // Chasm / Bottom boundary death condition
        if (player.y > canvas.height + 50) {
            damagePlayer(100);
        }

        if (player.health <= 0) {
            triggerGameOver();
        }

        // Platforms & Obstacles Collisions
        player.isGrounded = false;
        for (let p of platforms) {
            // Standing collision (Landing)
            if (player.vx + player.x + player.width > p.x &&
                player.x < p.x + p.width &&
                player.y + player.height >= p.y &&
                player.y + player.height - player.vy <= p.y + 10) {
                
                if (p.type === 'spikes') {
                    damagePlayer(15);
                    player.vy = -6.0;
                    player.vx = -1.5;
                } else {
                    player.y = p.y - player.height;
                    player.vy = 0;
                    player.isGrounded = true;
                }
            }

            // Lateral Wall collision
            if (p.type === 'watchtower' || p.type === 'barricade') {
                if (player.x + player.width >= p.x && player.x < p.x + p.width &&
                    player.y + player.height > p.y && player.y < p.y + p.height) {
                    
                    player.x = p.x - player.width;
                    player.vx = 0.5; // knockback push
                }
            }
        }

        // Process Player Projectiles (Gear Third fists)
        for (let i = playerProjectiles.length - 1; i >= 0; i--) {
            const proj = playerProjectiles[i];
            proj.x += proj.vx;

            if (proj.x < cameraX || proj.x > cameraX + canvas.width) {
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
                            // Boss defeated! We can proceed to Thousand Sunny
                        }
                    }
                    break;
                }
            }
        }

        // Enemies updates
        for (let enemy of enemies) {
            enemy.x += enemy.vx * enemy.direction;
            if (enemy.x <= enemy.patrolMin) enemy.direction = 1;
            if (enemy.x + enemy.width >= enemy.patrolMax) enemy.direction = -1;

            enemy.shootCooldown--;
            if (enemy.shootCooldown <= 0) {
                enemy.shootCooldown = enemy.type === 'boss' ? 70 : 110 + Math.random() * 80;
                
                const dx = player.x - enemy.x;
                const dy = player.y - enemy.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 420) {
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

            // Direct damage contact
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

            if (proj.x < cameraX - 50 || proj.x > cameraX + canvas.width + 50 || proj.y < -100 || proj.y > canvas.height + 100) {
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

        // Camera Tracking X (Smooth X scroll centering player)
        targetCameraX = player.x - 180;
        if (targetCameraX < 0) targetCameraX = 0;
        const maxCamX = maxLevelHeight + 1000 - canvas.width;
        if (targetCameraX > maxCamX) targetCameraX = maxCamX;
        cameraX += (targetCameraX - cameraX) * 0.1;

        // Progress distance score
        const currentDistance = Math.max(0, Math.floor(player.x / 10));
        if (currentDistance > highestHeight) {
            score += (currentDistance - highestHeight) * 10;
            highestHeight = currentDistance;
        }

        // Boss gate victory condition check (Must defeat Smoker to pass)
        if (player.x >= maxLevelHeight + 550) {
            const smokerAlive = enemies.some(e => e.type === 'boss');
            if (smokerAlive) {
                // block and bounce player back
                player.x = maxLevelHeight + 550;
                player.vx = -1.5;
                createSparks(player.x + player.width, player.y + player.height/2, '#ff3344', 4);
            } else {
                triggerVictory();
            }
        }

        updateHUD(currentDistance);
    }

    // Update HUD display
    function updateHUD(h) {
        healthBar.style.width = `${player.health}%`;
        energyBar.style.width = `${player.energy}%`;
        heightVal.textContent = `${h}m`;
        scoreVal.textContent = score;
    }

    // Draw Luffy Pixel Art Sprite
    function drawLuffy(ctx, px, py) {
        const timeFrame = player.animationFrame;
        const isRunning = Math.abs(player.vx) > 0.5;

        ctx.save();
        ctx.translate(px + player.width / 2, py + player.height / 2);
        ctx.scale(player.direction, 1);

        if (isRunning && player.isGrounded) {
            ctx.rotate(0.12);
        }

        // Straw Hat
        ctx.fillStyle = '#eedb52';
        ctx.fillRect(-12, -22, 24, 4);
        ctx.fillRect(-7, -27, 14, 5);
        ctx.fillStyle = '#ff3344';
        ctx.fillRect(-7, -23, 14, 2);

        // Head / skin
        ctx.fillStyle = '#ffccaa';
        ctx.fillRect(-6, -18, 12, 8);
        
        // Hair / grin
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(-7, -18, 2, 8);
        ctx.fillRect(4, -14, 2, 2);
        ctx.fillRect(-4, -10, 8, 2);

        // Red Vest
        ctx.fillStyle = '#ff3344';
        ctx.fillRect(-8, -10, 16, 11);
        ctx.fillStyle = '#ffeedd';
        ctx.fillRect(-2, -10, 4, 6);

        // Blue Shorts
        ctx.fillStyle = '#3a86c8';
        ctx.fillRect(-8, 1, 16, 8);

        // Legs run cycle
        ctx.fillStyle = '#ffccaa';
        if (player.isGrounded) {
            if (isRunning) {
                if (timeFrame === 0) {
                    ctx.fillRect(2, 9, 5, 8);
                    ctx.fillRect(-8, 9, 4, 8);
                    ctx.fillRect(-10, 15, 4, 2);
                } else if (timeFrame === 1 || timeFrame === 3) {
                    ctx.fillRect(-4, 9, 4, 8);
                    ctx.fillRect(0, 9, 4, 8);
                } else if (timeFrame === 2) {
                    ctx.fillRect(-7, 9, 5, 8);
                    ctx.fillRect(3, 9, 4, 8);
                    ctx.fillRect(5, 15, 4, 2);
                }
            } else {
                ctx.fillRect(-5, 9, 4, 8);
                ctx.fillRect(1, 9, 4, 8);
                ctx.fillRect(-7, 15, 3, 2);
                ctx.fillRect(1, 15, 3, 2);
            }
        } else {
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
                    ctx.fillRect(-11, -8, 3, 7);
                    ctx.fillRect(8, -6, 4, 4);
                } else {
                    ctx.fillRect(8, -8, 3, 7);
                    ctx.fillRect(-11, -6, 4, 4);
                }
            } else {
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
        // Translate for X camera scrolling
        ctx.translate(-cameraX, 0);

        // 1. Parallax background pillars/clouds
        ctx.fillStyle = '#161d28';
        const bgStart = Math.floor(cameraX / 300) * 300 - 300;
        for (let x = bgStart; x < cameraX + canvas.width + 300; x += 300) {
            ctx.fillRect(x + 50, 40, 8, GROUND_Y - 40);
            ctx.fillRect(x + 180, 80, 8, GROUND_Y - 80);
        }

        // 2. Draw Ground and Platforms
        for (let p of platforms) {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.width, p.height);

            // Lighting caps/cracks
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.fillRect(p.x, p.y, p.width, 3);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(p.x, p.y + p.height - 4, p.width, 4);

            if (p.type === 'watchtower') {
                ctx.strokeStyle = '#281715';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(p.x + 12, p.y + 4);
                ctx.lineTo(p.x + p.width - 12, p.y + p.height);
                ctx.moveTo(p.x + p.width - 12, p.y + 4);
                ctx.lineTo(p.x + 12, p.y + p.height);
                ctx.stroke();

                ctx.fillStyle = '#5d4037';
                ctx.fillRect(p.x - 5, p.y - 12, p.width + 10, 4);
            } else if (p.type === 'spikes') {
                ctx.fillStyle = '#7f8c8d';
                ctx.beginPath();
                for (let sx = p.x; sx < p.x + p.width; sx += 10) {
                    ctx.moveTo(sx, p.y + p.height);
                    ctx.lineTo(sx + 5, p.y);
                    ctx.lineTo(sx + 10, p.y + p.height);
                }
                ctx.fill();
            }
        }

        // 3. Draw Enemies (One Piece Marine Uniforms)
        for (let enemy of enemies) {
            if (enemy.type === 'boss') {
                // Smoker floating on smoke
                ctx.fillStyle = '#d1d8e0';
                ctx.fillRect(enemy.x - 5, enemy.y + enemy.height - 22, enemy.width + 10, 22);
                ctx.fillStyle = '#4f5d75';
                ctx.fillRect(enemy.x, enemy.y + 8, enemy.width, enemy.height - 26);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(enemy.x + 8, enemy.y - 8, enemy.width - 16, 8);
                ctx.fillStyle = '#ffccaa';
                ctx.fillRect(enemy.x + 6, enemy.y, enemy.width - 12, 8);
                
                ctx.strokeStyle = '#7f8c8d';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(enemy.x + enemy.width, enemy.y + 15);
                ctx.lineTo(enemy.x + enemy.width + 10, enemy.y - 12);
                ctx.stroke();
            } else {
                // Patrolling Marine Guard
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(enemy.x, enemy.y + 8, enemy.width, enemy.height - 20);
                ctx.fillStyle = '#0f2042';
                ctx.fillRect(enemy.x, enemy.y + enemy.height - 12, enemy.width, 12);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(enemy.x + 2, enemy.y - 6, enemy.width - 4, 6);
                ctx.fillStyle = '#0f2042';
                ctx.fillRect(enemy.x + (enemy.direction === 1 ? enemy.width - 5 : 0), enemy.y - 2, 5, 2);
            }

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
                ctx.fillStyle = 'rgba(209, 216, 224, 0.7)';
                ctx.fillRect(proj.x, proj.y, proj.width, proj.height);
            } else {
                ctx.fillStyle = '#ffd152';
                ctx.beginPath();
                ctx.arc(proj.x + 3, proj.y + 3, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 6. Draw Grappling Arm (Gomu Gomu arm)
        if (player.grapple.active) {
            ctx.strokeStyle = '#ffccaa';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(player.x + player.width / 2, player.y + 10);
            ctx.lineTo(player.grapple.tx, player.grapple.ty);
            ctx.stroke();

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

        // 9. Draw Chasing Tsunami (From the left side)
        ctx.fillStyle = 'rgba(0, 255, 255, 0.45)';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        const waveTime = Date.now() * 0.005;
        ctx.moveTo(tsunamiX - 100, canvas.height + 200);
        for (let y = canvas.height + 100; y >= -100; y -= 15) {
            const waveOffsetX = Math.sin(y * 0.045 + waveTime) * 12 + Math.cos(y * 0.02 + waveTime * 0.5) * 6;
            ctx.lineTo(tsunamiX + waveOffsetX, y);
        }
        ctx.lineTo(tsunamiX - 220, -100);
        ctx.lineTo(tsunamiX - 220, canvas.height + 200);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore(); // cameraX
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
