import { NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
});

export async function POST(req: Request) {
    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get('file') as Blob;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Optimization: Process in-memory without disk I/O
        const buffer = Buffer.from(await file.arrayBuffer());
        // Convert to OpenAI compatible file object
        const fileObj = await toFile(buffer, 'speech.webm', { type: 'audio/webm' });

        const transcription = await openai.audio.transcriptions.create({
            file: fileObj,
            model: "whisper-1",
            language: "en",
            prompt: "King James Bible verses. John 3:16. Genesis 1:1. Numbers as digits.", // Optimized prompt
        });

        return NextResponse.json({ text: transcription.text });

    } catch (error: any) {
        console.error("Transcribe Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
