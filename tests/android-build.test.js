const test=require('node:test');
const assert=require('node:assert/strict');
const {javaMajor}=require('../scripts/android.cjs');
test('distingue Java 21 del JBR 25 que no admite Gradle',()=>{
 assert.equal(javaMajor('openjdk version "21.0.8" 2025-07-15'),21);
 assert.equal(javaMajor('openjdk version "25.0.1" 2025-10-21'),25);
 assert.equal(javaMajor('java version "21"'),21);
 assert.equal(javaMajor('not found'),null);
});
