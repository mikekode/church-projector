
// Remove require, use global fetch (Node 18+)
// const fetch = require('node-fetch'); 

const BASE_URL = 'http://localhost:3000/api/intent';

async function test(name, payload) {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`   Input: "${payload.text}"`);
    try {
        const res = await fetch(BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        console.log('   ✅ Output:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('   ❌ Error:', e.message);
    }
}

async function runTests() {
    // 1. Basic Verse Detection
    await test("Basic Verse", {
        text: "Let's read from John 3:16 please"
    });

    // 2. Paraphrase / Semantic Search
    await test("Semantic Quote", {
        text: "The Lord is my shepherd I shall not want"
    });

    // 3. Natural Language Command (Clear)
    await test("Clear Command", {
        text: "Okay remove this scripture off the screen now"
    });

    // 4. Contextual Translation Change
    await test("Context: Change Translation", {
        text: "Actually read that in NLT",
        context: { book: "John", chapter: 3, verse: 16, version: "KJV" }
    });

    // 5. History Navigation
    await test("History: Go to First", {
        text: "Go back to the first scripture we read today",
        historySummary: [
            { reference: "Genesis 1:1", text_snippet: "In the beginning..." },
            { reference: "John 3:16", text_snippet: "For God so loved..." }
        ]
    });

    // 6. Multi-Verse Range
    await test("Verse Range", {
        text: "Read Psalm 23 verses 1 through 4"
    });
}

runTests();
