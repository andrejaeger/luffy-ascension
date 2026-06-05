const assert = require('assert');

// Mock spring mechanics matching game.js
function calculateSpringForce(dist, restLength, k) {
    if (dist <= restLength) return 0;
    return (dist - restLength) * k;
}

// Mock horizontal running speed modifiers matching game.js
function getAdjustedSpeed(vx, keys, baseSpeed) {
    let speed = vx;
    if (keys.d) {
        speed = Math.min(5.8, speed + 0.15);
    } else if (keys.a) {
        speed = Math.max(1.5, speed - 0.15);
    } else {
        if (speed < baseSpeed) speed = Math.min(baseSpeed, speed + 0.1);
        if (speed > baseSpeed) speed = Math.max(baseSpeed, speed - 0.1);
    }
    return Math.round(speed * 100) / 100;
}

// Mock tsunami rubber-band chase logic matching game.js
function updateTsunamiX(playerX, waveX, tsunamiBaseSpeed) {
    const distance = playerX - waveX;
    let tsunamiSpeed = tsunamiBaseSpeed;
    if (distance > 380) {
        tsunamiSpeed = Math.min(6.5, tsunamiSpeed + (distance - 380) * 0.015);
    } else if (distance < 120) {
        tsunamiSpeed = Math.max(1.8, tsunamiSpeed - (120 - distance) * 0.05);
    }
    return {
        x: waveX + tsunamiSpeed,
        isOverlapping: (playerX < waveX + 15)
    };
}

// Run unit tests
try {
    console.log("🚀 Running unit tests for Luffy's Horizontal Runner mechanics...");

    // Test 1: Grappling Spring Force
    console.log("Test 1: calculateSpringForce");
    assert.strictEqual(calculateSpringForce(100, 200, 0.1), 0, "Slack rope produces zero tension force");
    assert.strictEqual(calculateSpringForce(250, 200, 0.08), 4.0, "Spring force should pull (250-200)*0.08 = 4.0");
    console.log("✅ Test 1 Passed!");

    // Test 2: Input Speed adjustment
    console.log("Test 2: getAdjustedSpeed");
    assert.strictEqual(getAdjustedSpeed(3.5, { d: true }, 3.5), 3.65, "Should accelerate by 0.15 on D key");
    assert.strictEqual(getAdjustedSpeed(3.5, { a: true }, 3.5), 3.35, "Should decelerate by 0.15 on A key");
    assert.strictEqual(getAdjustedSpeed(5.0, {}, 3.5), 4.9, "Should gradually return to base run speed when no keys pressed");
    console.log("✅ Test 2 Passed!");

    // Test 3: Tsunami Chase and Submersion
    console.log("Test 3: updateTsunamiX");
    const waveClose = updateTsunamiX(100, 0, 3.3); // distance = 100 (< 120)
    assert.strictEqual(waveClose.isOverlapping, false, "Not overlapping when player is ahead");
    assert.strictEqual(waveClose.x, 2.3, "Wave speed should slow down (3.3 - (120-100)*0.05 = 2.3)");

    const waveAhead = updateTsunamiX(500, 0, 3.3); // distance = 500 (> 380)
    assert.strictEqual(waveAhead.x, 5.1, "Wave speed should accelerate (3.3 + (500-380)*0.015 = 5.1)");

    const waveOver = updateTsunamiX(10, 0, 3.3); // playerX (10) < waveX + 15 (15)
    assert.strictEqual(waveOver.isOverlapping, true, "Player is caught inside wave when distance is under 15px");
    console.log("✅ Test 3 Passed!");

    console.log("\n🎉 All horizontal runner test suites passed successfully!");
    process.exit(0);
} catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
}
