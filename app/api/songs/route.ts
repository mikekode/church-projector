import { NextResponse } from 'next/server';
import songsData from '@/data/songs.json';

export async function GET() {
    return NextResponse.json(songsData);
}
