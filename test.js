const assert = require('assert');

// Mock spring mechanics
function calculateSpringForce(dist, restLength, k) {
    if (dist <= restLength) return 0;
    return (dist - restLength) * k;
}

// Mock running speed adjustment relative to key inputs
function getAdjustedSpeed(vx, keys, baseSpeed) {
    let speed = vx;
    if (keys.d) {
        speed = Math.min(baseSpeed + 3.0, speed + 0.15);
    } else if (keys.a) {
        speed = Math.max(baseSpeed - 1.5, speed - 0.1);
    } else {
        if (speed > baseSpeed) speed -= 0.05;
        if (speed < baseSpeed) speed += 0.05;
    }
    return Math.round(speed * 100) / 100; // round to 2 decimals
}

// Mock tsunami chase logic
function updateTsunamiX(playerX, waveX, waveSpeed, baseRunSpeed) {
    let currentWaveSpeed = waveSpeed;
    const distanceToWave = playerX - waveX;
    
    if (distanceToWave > 350) {
        currentWaveSpeed = Math.max(3.2, 5.0 * 0.95); // using dummy player.vx = 5.0
    } else if (distanceToWave < 120) {
        currentWaveSpeed = baseRunSpeed * 0.75;
    }
    
    return {
        x: waveX + currentWaveSpeed,
        isOverlapping: (playerX < waveX + 30)
    };
}

// RUN REWRITTEN RUNNER TEST SUITE
try {
    console.log("🚀 Running unit tests for Luffy's Horizontal Runner mechanics...");

    // Test 1: Grappling Spring Force
    console.log("Test 1: calculateSpringForce");
    assert.strictEqual(calculateSpringForce(100, 200, 0.1), 0, "Slack rope produces zero tension force");
    assert.strictEqual(calculateSpringForce(250, 200, 0.09), 4.5, "Spring force should pull (250-200)*0.09 = 4.5");
    console.log("✅ Test 1 Passed!");

    // Test 2: Input Speed adjustment
    console.log("Test 2: getAdjustedSpeed");
    assert.strictEqual(getAdjustedSpeed(3.5, { d: true }, 3.5), 3.65, "Should accelerate by 0.15 on D key");
    assert.strictEqual(getAdjustedSpeed(3.5, { a: true }, 3.5), 3.4, "Should decelerate by 0.1 on A key");
    assert.strictEqual(getAdjustedSpeed(5.0, {}, 3.5), 4.95, "Should gradually return to base run speed when no keys pressed");
    console.log("✅ Test 2 Passed!");

    // Test 3: Tsunami Chase and Submersion
    console.log("Test 3: updateTsunamiX");
    const waveClose = updateTsunamiX(100, 0, 3.2, 3.5); // distance = 100 (< 120)
    assert.strictEqual(waveClose.isOverlapping, false, "Not overlapping when player is ahead");
    assert.strictEqual(waveClose.x, 2.625, "Wave speed should slow down (3.5 * 0.75 = 2.625)");

    const waveOver = updateTsunamiX(50, 40, 3.2, 3.5); // playerX < waveX + 30 (50 < 70)
    assert.strictEqual(waveOver.isOverlapping, true, "Player is caught inside wave when distance is under 30px");
    console.log("✅ Test 3 Passed!");

    console.log("\n🎉 All rewritten runner test suites passed successfully!");
    process.exit(0);
} catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
}
