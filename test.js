const assert = require('assert');

// Mock a lightweight version of game physics and state for unit testing
function calculateSpringForce(dist, restLength, k) {
    if (dist <= restLength) return 0;
    return (dist - restLength) * k;
}

function constrainPlayerX(x, width, canvasWidth) {
    let vx = 1; // dummy velocity
    let px = x;
    if (px < 0) {
        px = 0;
        vx = 0;
    }
    if (px + width > canvasWidth) {
        px = canvasWidth - width;
        vx = 0;
    }
    return { x: px, vx };
}

function processDamage(health, amt, invulnerableFrames) {
    if (invulnerableFrames > 0) return { health, invulnerableFrames };
    return {
        health: Math.max(0, health - amt),
        invulnerableFrames: 30
    };
}

// RUN TESTS
try {
    console.log("🚀 Running unit tests for Luffy's Ascension physics and mechanics...");

    // Test 1: Elastic spring force calculations
    console.log("Test 1: calculateSpringForce");
    assert.strictEqual(calculateSpringForce(100, 200, 0.1), 0, "No spring force when compressed/slack");
    assert.strictEqual(calculateSpringForce(250, 200, 0.08), 4, "Spring force should be (250-200)*0.08 = 4");
    console.log("✅ Test 1 Passed!");

    // Test 2: Player boundary constraints
    console.log("Test 2: constrainPlayerX");
    const test1 = constrainPlayerX(-10, 20, 480);
    assert.strictEqual(test1.x, 0, "X should be constrained to 0 when negative");
    assert.strictEqual(test1.vx, 0, "Velocity should reset to 0 on boundary hit");

    const test2 = constrainPlayerX(470, 20, 480);
    assert.strictEqual(test2.x, 460, "X should be constrained to canvasWidth - playerWidth");
    assert.strictEqual(test2.vx, 0, "Velocity should reset to 0 on right boundary hit");
    console.log("✅ Test 2 Passed!");

    // Test 3: Player health and invulnerability frames
    console.log("Test 3: processDamage");
    const dmg1 = processDamage(100, 25, 0);
    assert.strictEqual(dmg1.health, 75, "Health should decrease by 25");
    assert.strictEqual(dmg1.invulnerableFrames, 30, "Should set 30 invulnerability frames");

    const dmg2 = processDamage(75, 25, 20);
    assert.strictEqual(dmg2.health, 75, "Health should not decrease when invulnerable");
    assert.strictEqual(dmg2.invulnerableFrames, 20, "Invulnerability frames should remain unchanged");

    const dmg3 = processDamage(10, 25, 0);
    assert.strictEqual(dmg3.health, 0, "Health should not go below 0");
    console.log("✅ Test 3 Passed!");

    console.log("\n🎉 All 3 test suites passed successfully!");
    process.exit(0);
} catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
}
