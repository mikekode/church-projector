
import { detectVersesInText } from './bible';

const testCases = [
    "Open your bibles to John 3:16 please",
    "John chapter three verse sixteen",
    "First John 3:16",
    "1 John 3 16",
    "Second Kings 4:2",
    "Let's look at Revelations 3:20", // Handling plural 'Revelations'
    "Genesis one one",
    "Exodus chapter 5", // Just chapter? My logic currently requires verse.
];

console.log("--- STARTING DETECTION TEST ---");

testCases.forEach(text => {
    console.log(`\nInput: "${text}"`);
    const results = detectVersesInText(text);
    if (results.length === 0) {
        console.log("❌ No match found");
    } else {
        results.forEach(r => {
            console.log(`✅ MATCH: ${r.reference} => "${r.text.substring(0, 30)}..."`);
        });
    }
});

console.log("\n--- TEST COMPLETE ---");
