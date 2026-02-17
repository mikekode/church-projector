/**
 * Curated Bible Verse Index — Top ~3,000 most preached/quoted verses
 *
 * This module exports the list of verse references to include in the
 * local semantic embeddings index. These are the verses most commonly
 * preached, quoted, memorized, and paraphrased in church settings.
 *
 * Format: { book: abbrev, chapter: number, verse: number }
 * The abbrev matches the KJV JSON format used in bible.ts
 *
 * Categories covered:
 *   - Salvation & Gospel (John 3:16, Romans 10:9, etc.)
 *   - Faith & Trust (Proverbs 3:5-6, Hebrews 11:1, etc.)
 *   - Comfort & Peace (Psalm 23, Isaiah 41:10, Phil 4:6-7, etc.)
 *   - Love (1 Corinthians 13, 1 John 4:8, etc.)
 *   - Prayer (Matthew 6:9-13, James 5:16, etc.)
 *   - Strength & Courage (Joshua 1:9, Isaiah 40:31, etc.)
 *   - Wisdom (James 1:5, Proverbs 1-9 highlights, etc.)
 *   - Purpose & Calling (Jeremiah 29:11, Romans 8:28, etc.)
 *   - Worship & Praise (Psalm 100, 150, etc.)
 *   - End Times & Prophecy (Revelation highlights, Daniel, etc.)
 *   - Plus entire chapters of Psalms, Proverbs highlights, and sermon favorites
 */

export interface VerseRef {
    book: string;   // KJV JSON abbrev (e.g., "gn", "jo", "rm")
    chapter: number;
    verse: number;
}

// Book name to abbrev mapping (matching kjv.json)
const B: Record<string, string> = {
    Gen: 'gn', Ex: 'ex', Lv: 'lv', Nm: 'nm', Dt: 'dt',
    Js: 'js', Jud: 'jud', Rt: 'rt', '1Sm': '1sm', '2Sm': '2sm',
    '1Kgs': '1kgs', '2Kgs': '2kgs', '1Ch': '1ch', '2Ch': '2ch',
    Ezr: 'ezr', Ne: 'ne', Et: 'et', Job: 'job', Ps: 'ps',
    Prv: 'prv', Ec: 'ec', So: 'so', Isa: 'is', Jr: 'jr',
    Lm: 'lm', Ez: 'ez', Dn: 'dn', Ho: 'ho', Jl: 'jl',
    Am: 'am', Ob: 'ob', Jonah: 'jn', Mi: 'mi', Na: 'na',
    Hab: 'hk', Zp: 'zp', Hg: 'hg', Zc: 'zc', Ml: 'ml',
    Mt: 'mt', Mk: 'mk', Lk: 'lk', Jh: 'jo', Ac: 'act',
    Rm: 'rm', '1Co': '1co', '2Co': '2co', Gl: 'gl', Ep: 'eph',
    Ph: 'ph', Cl: 'cl', '1Th': '1ts', '2Th': '2ts',
    '1Tm': '1tm', '2Tm': '2tm', Tt: 'tt', Phm: 'phm',
    Heb: 'hb', Jm: 'jm', '1Pe': '1pe', '2Pe': '2pe',
    '1Jo': '1jo', '2Jo': '2jo', '3Jo': '3jo', Jd: 'jd', Re: 're'
};

/** Helper: Generate a range of verse refs */
function range(book: string, chapter: number, from: number, to: number): VerseRef[] {
    const refs: VerseRef[] = [];
    for (let v = from; v <= to; v++) {
        refs.push({ book, chapter, verse: v });
    }
    return refs;
}

/** Helper: Single verse ref */
function v(book: string, chapter: number, verse: number): VerseRef {
    return { book, chapter, verse };
}

/**
 * Generate the curated list of ~3,000 most preached verse references.
 */
export function getCuratedVerseRefs(): VerseRef[] {
    const refs: VerseRef[] = [];

    // ═══════════════════════════════════════════════════════
    // GENESIS — Creation, Promises, Faith heroes
    // ═══════════════════════════════════════════════════════
    refs.push(...range(B.Gen, 1, 1, 31));     // Creation account
    refs.push(...range(B.Gen, 2, 1, 7));
    refs.push(...range(B.Gen, 3, 1, 24));     // The Fall
    refs.push(v(B.Gen, 12, 1), v(B.Gen, 12, 2), v(B.Gen, 12, 3)); // Abrahamic call
    refs.push(v(B.Gen, 15, 6));               // Abraham believed
    refs.push(v(B.Gen, 22, 8), v(B.Gen, 22, 14)); // God will provide
    refs.push(v(B.Gen, 50, 20));               // Meant for good

    // ═══════════════════════════════════════════════════════
    // EXODUS — Liberation, Commandments
    // ═══════════════════════════════════════════════════════
    refs.push(...range(B.Ex, 3, 1, 15));       // Burning bush
    refs.push(...range(B.Ex, 14, 13, 14));     // Stand still and see
    refs.push(...range(B.Ex, 20, 1, 17));      // Ten Commandments

    // ═══════════════════════════════════════════════════════
    // DEUTERONOMY — Blessings, Commands
    // ═══════════════════════════════════════════════════════
    refs.push(...range(B.Dt, 6, 4, 9));        // Shema
    refs.push(v(B.Dt, 28, 1), v(B.Dt, 28, 13));
    refs.push(...range(B.Dt, 31, 6, 8));       // Be strong

    // ═══════════════════════════════════════════════════════
    // JOSHUA — Courage
    // ═══════════════════════════════════════════════════════
    refs.push(...range(B.Js, 1, 5, 9));        // Be strong and courageous
    refs.push(v(B.Js, 24, 15));                // As for me and my house

    // ═══════════════════════════════════════════════════════
    // 1 & 2 SAMUEL
    // ═══════════════════════════════════════════════════════
    refs.push(v(B['1Sm'], 16, 7));             // Man looks outward, God looks at heart
    refs.push(v(B['1Sm'], 17, 45), v(B['1Sm'], 17, 47)); // David and Goliath
    refs.push(v(B['2Sm'], 22, 2), v(B['2Sm'], 22, 3));

    // ═══════════════════════════════════════════════════════
    // 1 & 2 CHRONICLES
    // ═══════════════════════════════════════════════════════
    refs.push(v(B['1Ch'], 16, 11), v(B['1Ch'], 16, 34));
    refs.push(v(B['2Ch'], 7, 14));             // If my people

    // ═══════════════════════════════════════════════════════
    // NEHEMIAH
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Ne, 8, 10));                 // Joy of the Lord

    // ═══════════════════════════════════════════════════════
    // JOB — Suffering, faith
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Job, 1, 21));                // Lord gave, Lord took
    refs.push(v(B.Job, 13, 15));               // Though he slay me
    refs.push(v(B.Job, 19, 25), v(B.Job, 19, 26)); // My Redeemer lives
    refs.push(...range(B.Job, 38, 1, 7));      // God answers out of whirlwind

    // ═══════════════════════════════════════════════════════
    // PSALMS — The heart of worship preaching
    // ═══════════════════════════════════════════════════════
    refs.push(...range(B.Ps, 1, 1, 6));        // Blessed is the man
    refs.push(...range(B.Ps, 8, 1, 9));
    refs.push(v(B.Ps, 16, 8), v(B.Ps, 16, 11));
    refs.push(...range(B.Ps, 18, 1, 3));
    refs.push(...range(B.Ps, 19, 1, 14));
    refs.push(...range(B.Ps, 22, 1, 5));
    refs.push(...range(B.Ps, 23, 1, 6));       // The Lord is my shepherd
    refs.push(...range(B.Ps, 24, 1, 10));
    refs.push(v(B.Ps, 25, 4), v(B.Ps, 25, 5));
    refs.push(v(B.Ps, 27, 1), v(B.Ps, 27, 4), v(B.Ps, 27, 14));
    refs.push(v(B.Ps, 28, 7));
    refs.push(v(B.Ps, 29, 2), v(B.Ps, 29, 11));
    refs.push(v(B.Ps, 30, 5), v(B.Ps, 30, 11), v(B.Ps, 30, 12));
    refs.push(v(B.Ps, 31, 3), v(B.Ps, 31, 14), v(B.Ps, 31, 15), v(B.Ps, 31, 24));
    refs.push(v(B.Ps, 32, 1), v(B.Ps, 32, 8));
    refs.push(v(B.Ps, 33, 11), v(B.Ps, 33, 18), v(B.Ps, 33, 20), v(B.Ps, 33, 22));
    refs.push(...range(B.Ps, 34, 1, 10));
    refs.push(v(B.Ps, 34, 17), v(B.Ps, 34, 18), v(B.Ps, 34, 19));
    refs.push(v(B.Ps, 37, 4), v(B.Ps, 37, 5), v(B.Ps, 37, 7), v(B.Ps, 37, 23), v(B.Ps, 37, 25));
    refs.push(v(B.Ps, 40, 1), v(B.Ps, 40, 2), v(B.Ps, 40, 3));
    refs.push(v(B.Ps, 42, 1), v(B.Ps, 42, 5), v(B.Ps, 42, 11));
    refs.push(v(B.Ps, 46, 1), v(B.Ps, 46, 10));  // Be still and know
    refs.push(v(B.Ps, 51, 1), v(B.Ps, 51, 2), v(B.Ps, 51, 10), v(B.Ps, 51, 12), v(B.Ps, 51, 17));
    refs.push(v(B.Ps, 55, 22));
    refs.push(v(B.Ps, 56, 3), v(B.Ps, 56, 4));
    refs.push(v(B.Ps, 62, 1), v(B.Ps, 62, 2), v(B.Ps, 62, 5), v(B.Ps, 62, 6));
    refs.push(v(B.Ps, 63, 1), v(B.Ps, 63, 3));
    refs.push(v(B.Ps, 66, 16), v(B.Ps, 66, 18));
    refs.push(v(B.Ps, 68, 19));
    refs.push(...range(B.Ps, 91, 1, 16));       // Under His wings
    refs.push(...range(B.Ps, 95, 1, 7));
    refs.push(...range(B.Ps, 100, 1, 5));       // Make a joyful noise
    refs.push(v(B.Ps, 103, 1), v(B.Ps, 103, 2), v(B.Ps, 103, 3), v(B.Ps, 103, 8), v(B.Ps, 103, 11), v(B.Ps, 103, 12), v(B.Ps, 103, 13), v(B.Ps, 103, 17));
    refs.push(v(B.Ps, 107, 1));
    refs.push(v(B.Ps, 118, 1), v(B.Ps, 118, 6), v(B.Ps, 118, 8), v(B.Ps, 118, 24));  // This is the day
    refs.push(v(B.Ps, 119, 9), v(B.Ps, 119, 11), v(B.Ps, 119, 105), v(B.Ps, 119, 130));  // Thy word is a lamp
    refs.push(...range(B.Ps, 121, 1, 8));       // I lift mine eyes
    refs.push(v(B.Ps, 127, 1), v(B.Ps, 127, 3));
    refs.push(...range(B.Ps, 139, 1, 18));      // Search me, O God
    refs.push(v(B.Ps, 139, 23), v(B.Ps, 139, 24));
    refs.push(...range(B.Ps, 145, 1, 9));
    refs.push(...range(B.Ps, 150, 1, 6));       // Let everything praise

    // ═══════════════════════════════════════════════════════
    // PROVERBS — Wisdom preaching favorites
    // ═══════════════════════════════════════════════════════
    refs.push(...range(B.Prv, 1, 7, 9));
    refs.push(...range(B.Prv, 3, 1, 12));       // Trust in the Lord
    refs.push(v(B.Prv, 4, 7), v(B.Prv, 4, 23));
    refs.push(v(B.Prv, 10, 22));
    refs.push(v(B.Prv, 11, 2), v(B.Prv, 11, 14), v(B.Prv, 11, 25), v(B.Prv, 11, 30));
    refs.push(v(B.Prv, 12, 1), v(B.Prv, 12, 15));
    refs.push(v(B.Prv, 13, 20), v(B.Prv, 13, 24));
    refs.push(v(B.Prv, 14, 12), v(B.Prv, 14, 26), v(B.Prv, 14, 34));
    refs.push(v(B.Prv, 15, 1), v(B.Prv, 15, 3), v(B.Prv, 15, 13), v(B.Prv, 15, 33));
    refs.push(v(B.Prv, 16, 3), v(B.Prv, 16, 9), v(B.Prv, 16, 18), v(B.Prv, 16, 32));
    refs.push(v(B.Prv, 17, 17), v(B.Prv, 17, 22));
    refs.push(v(B.Prv, 18, 10), v(B.Prv, 18, 21), v(B.Prv, 18, 24));  // Name of the Lord is a strong tower
    refs.push(v(B.Prv, 19, 17), v(B.Prv, 19, 21));
    refs.push(v(B.Prv, 20, 7));
    refs.push(v(B.Prv, 21, 1), v(B.Prv, 21, 31));
    refs.push(v(B.Prv, 22, 1), v(B.Prv, 22, 6));  // Train up a child
    refs.push(v(B.Prv, 27, 1), v(B.Prv, 27, 17));  // Iron sharpens iron
    refs.push(v(B.Prv, 29, 18), v(B.Prv, 29, 25));
    refs.push(...range(B.Prv, 31, 10, 31));     // Virtuous woman

    // ═══════════════════════════════════════════════════════
    // ECCLESIASTES
    // ═══════════════════════════════════════════════════════
    refs.push(...range(B.Ec, 3, 1, 8));         // A time for everything
    refs.push(v(B.Ec, 4, 9), v(B.Ec, 4, 10), v(B.Ec, 4, 12));
    refs.push(v(B.Ec, 12, 13), v(B.Ec, 12, 14));

    // ═══════════════════════════════════════════════════════
    // ISAIAH — Messianic prophecies, comfort
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Isa, 6, 8));                  // Here am I, send me
    refs.push(v(B.Isa, 7, 14));                 // Virgin shall conceive
    refs.push(v(B.Isa, 9, 6), v(B.Isa, 9, 7)); // For unto us a child is born
    refs.push(v(B.Isa, 11, 1), v(B.Isa, 11, 2));
    refs.push(v(B.Isa, 25, 8), v(B.Isa, 25, 9));
    refs.push(v(B.Isa, 26, 3), v(B.Isa, 26, 4)); // Perfect peace
    refs.push(v(B.Isa, 30, 21));
    refs.push(v(B.Isa, 35, 4), v(B.Isa, 35, 10));
    refs.push(v(B.Isa, 40, 8), v(B.Isa, 40, 28), v(B.Isa, 40, 29), v(B.Isa, 40, 30), v(B.Isa, 40, 31));  // They that wait upon the Lord
    refs.push(v(B.Isa, 41, 10), v(B.Isa, 41, 13)); // Fear not
    refs.push(v(B.Isa, 43, 1), v(B.Isa, 43, 2), v(B.Isa, 43, 18), v(B.Isa, 43, 19));  // Behold I do a new thing
    refs.push(v(B.Isa, 44, 3));
    refs.push(v(B.Isa, 45, 2), v(B.Isa, 45, 3));
    refs.push(v(B.Isa, 46, 4));
    refs.push(v(B.Isa, 48, 17));
    refs.push(...range(B.Isa, 53, 1, 12));       // Suffering Servant
    refs.push(v(B.Isa, 54, 17));                  // No weapon formed
    refs.push(v(B.Isa, 55, 6), v(B.Isa, 55, 8), v(B.Isa, 55, 9), v(B.Isa, 55, 10), v(B.Isa, 55, 11));
    refs.push(v(B.Isa, 58, 11));
    refs.push(v(B.Isa, 59, 1));
    refs.push(v(B.Isa, 61, 1), v(B.Isa, 61, 3));  // Beauty for ashes
    refs.push(v(B.Isa, 64, 4));
    refs.push(v(B.Isa, 65, 24));

    // ═══════════════════════════════════════════════════════
    // JEREMIAH — Prophecy, promises
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Jr, 1, 5));                    // Before I formed you
    refs.push(v(B.Jr, 17, 7), v(B.Jr, 17, 8));
    refs.push(v(B.Jr, 29, 11), v(B.Jr, 29, 12), v(B.Jr, 29, 13));  // Plans to prosper you
    refs.push(v(B.Jr, 31, 3));
    refs.push(v(B.Jr, 33, 3));                   // Call unto me

    // ═══════════════════════════════════════════════════════
    // LAMENTATIONS
    // ═══════════════════════════════════════════════════════
    refs.push(...range(B.Lm, 3, 22, 26));        // New every morning

    // ═══════════════════════════════════════════════════════
    // EZEKIEL
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Ez, 37, 1), v(B.Ez, 37, 3), v(B.Ez, 37, 4), v(B.Ez, 37, 5)); // Dry bones

    // ═══════════════════════════════════════════════════════
    // DANIEL — Faith under pressure
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Dn, 3, 17), v(B.Dn, 3, 18));  // Fiery furnace
    refs.push(v(B.Dn, 6, 10), v(B.Dn, 6, 22));  // Lion's den

    // ═══════════════════════════════════════════════════════
    // HOSEA, JOEL, AMOS
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Ho, 6, 1), v(B.Ho, 6, 3));
    refs.push(v(B.Jl, 2, 25), v(B.Jl, 2, 28), v(B.Jl, 2, 32));
    refs.push(v(B.Am, 5, 24));

    // ═══════════════════════════════════════════════════════
    // MICAH
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Mi, 6, 8));                    // Do justly, love mercy
    refs.push(v(B.Mi, 7, 8));

    // ═══════════════════════════════════════════════════════
    // HABAKKUK, ZEPHANIAH
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Hab, 2, 2), v(B.Hab, 2, 3), v(B.Hab, 2, 4));
    refs.push(v(B.Hab, 3, 17), v(B.Hab, 3, 18), v(B.Hab, 3, 19));
    refs.push(v(B.Zp, 3, 17));                  // He will rejoice over you

    // ═══════════════════════════════════════════════════════
    // MALACHI
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Ml, 3, 6), v(B.Ml, 3, 8), v(B.Ml, 3, 10)); // Bring the tithes

    // ═══════════════════════════════════════════════════════
    // MATTHEW — Jesus' teachings, Sermon on Mount
    // ═══════════════════════════════════════════════════════
    refs.push(...range(B.Mt, 1, 18, 23));        // Birth of Christ
    refs.push(...range(B.Mt, 5, 1, 16));         // Beatitudes
    refs.push(...range(B.Mt, 5, 43, 48));
    refs.push(...range(B.Mt, 6, 1, 4));
    refs.push(...range(B.Mt, 6, 9, 15));         // Lord's Prayer
    refs.push(...range(B.Mt, 6, 19, 21));
    refs.push(v(B.Mt, 6, 24));
    refs.push(...range(B.Mt, 6, 25, 34));        // Do not worry
    refs.push(v(B.Mt, 7, 1), v(B.Mt, 7, 7), v(B.Mt, 7, 12)); // Ask seek knock
    refs.push(v(B.Mt, 7, 13), v(B.Mt, 7, 14));
    refs.push(...range(B.Mt, 7, 24, 27));        // Wise and foolish builders
    refs.push(v(B.Mt, 10, 28), v(B.Mt, 10, 29), v(B.Mt, 10, 30), v(B.Mt, 10, 31));
    refs.push(v(B.Mt, 11, 28), v(B.Mt, 11, 29), v(B.Mt, 11, 30)); // Come to me
    refs.push(v(B.Mt, 16, 18), v(B.Mt, 16, 24), v(B.Mt, 16, 25), v(B.Mt, 16, 26));
    refs.push(v(B.Mt, 17, 20));                  // Faith of a mustard seed
    refs.push(v(B.Mt, 18, 3), v(B.Mt, 18, 20)); // Where two or three are gathered
    refs.push(v(B.Mt, 19, 26));                  // With God all things are possible
    refs.push(v(B.Mt, 21, 22));
    refs.push(v(B.Mt, 22, 37), v(B.Mt, 22, 38), v(B.Mt, 22, 39)); // Greatest commandment
    refs.push(v(B.Mt, 24, 35), v(B.Mt, 24, 36));
    refs.push(...range(B.Mt, 25, 31, 46));       // Sheep and goats
    refs.push(...range(B.Mt, 28, 18, 20));       // Great Commission

    // ═══════════════════════════════════════════════════════
    // MARK
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Mk, 9, 23), v(B.Mk, 9, 24));
    refs.push(v(B.Mk, 10, 27), v(B.Mk, 10, 45)); // Ransom for many
    refs.push(v(B.Mk, 11, 22), v(B.Mk, 11, 23), v(B.Mk, 11, 24), v(B.Mk, 11, 25));
    refs.push(v(B.Mk, 12, 30), v(B.Mk, 12, 31));
    refs.push(v(B.Mk, 16, 15), v(B.Mk, 16, 16), v(B.Mk, 16, 17), v(B.Mk, 16, 18));

    // ═══════════════════════════════════════════════════════
    // LUKE
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Lk, 1, 37), v(B.Lk, 1, 45));  // Nothing impossible
    refs.push(...range(B.Lk, 2, 8, 14));          // Birth announcement
    refs.push(v(B.Lk, 4, 18), v(B.Lk, 4, 19));
    refs.push(v(B.Lk, 6, 27), v(B.Lk, 6, 28));
    refs.push(v(B.Lk, 6, 31));                   // Golden Rule
    refs.push(v(B.Lk, 6, 38));                   // Give and it shall be given
    refs.push(v(B.Lk, 9, 23), v(B.Lk, 9, 62));
    refs.push(v(B.Lk, 10, 19), v(B.Lk, 10, 27));
    refs.push(v(B.Lk, 11, 9), v(B.Lk, 11, 10));
    refs.push(v(B.Lk, 12, 15), v(B.Lk, 12, 32), v(B.Lk, 12, 48));
    refs.push(...range(B.Lk, 15, 3, 7));          // Lost sheep
    refs.push(v(B.Lk, 18, 1), v(B.Lk, 18, 27));
    refs.push(v(B.Lk, 19, 10));                   // Seek and save the lost

    // ═══════════════════════════════════════════════════════
    // JOHN — Core Gospel
    // ═══════════════════════════════════════════════════════
    refs.push(...range(B.Jh, 1, 1, 14));           // In the beginning was the Word
    refs.push(v(B.Jh, 3, 3), v(B.Jh, 3, 5));
    refs.push(v(B.Jh, 3, 16), v(B.Jh, 3, 17), v(B.Jh, 3, 18)); // For God so loved
    refs.push(v(B.Jh, 3, 30), v(B.Jh, 3, 36));
    refs.push(v(B.Jh, 4, 14), v(B.Jh, 4, 23), v(B.Jh, 4, 24)); // God is Spirit
    refs.push(v(B.Jh, 5, 24));
    refs.push(v(B.Jh, 6, 35), v(B.Jh, 6, 37), v(B.Jh, 6, 47));
    refs.push(v(B.Jh, 7, 37), v(B.Jh, 7, 38));
    refs.push(v(B.Jh, 8, 12), v(B.Jh, 8, 31), v(B.Jh, 8, 32), v(B.Jh, 8, 36));  // The truth shall set you free
    refs.push(v(B.Jh, 9, 25));
    refs.push(v(B.Jh, 10, 10), v(B.Jh, 10, 11), v(B.Jh, 10, 27), v(B.Jh, 10, 28), v(B.Jh, 10, 29), v(B.Jh, 10, 30));
    refs.push(v(B.Jh, 11, 25), v(B.Jh, 11, 26));  // I am the resurrection
    refs.push(v(B.Jh, 12, 46));
    refs.push(v(B.Jh, 13, 34), v(B.Jh, 13, 35));  // New commandment
    refs.push(v(B.Jh, 14, 1), v(B.Jh, 14, 2), v(B.Jh, 14, 3));
    refs.push(v(B.Jh, 14, 6));                     // I am the way
    refs.push(v(B.Jh, 14, 13), v(B.Jh, 14, 14));
    refs.push(v(B.Jh, 14, 15), v(B.Jh, 14, 16), v(B.Jh, 14, 17), v(B.Jh, 14, 26), v(B.Jh, 14, 27));  // Peace I leave with you
    refs.push(v(B.Jh, 15, 1), v(B.Jh, 15, 4), v(B.Jh, 15, 5));  // I am the vine
    refs.push(v(B.Jh, 15, 7), v(B.Jh, 15, 9), v(B.Jh, 15, 12), v(B.Jh, 15, 13));
    refs.push(v(B.Jh, 15, 16));
    refs.push(v(B.Jh, 16, 13), v(B.Jh, 16, 33));  // Be of good cheer
    refs.push(v(B.Jh, 17, 3), v(B.Jh, 17, 17));

    // ═══════════════════════════════════════════════════════
    // ACTS — Early church, Holy Spirit
    // ═══════════════════════════════════════════════════════
    refs.push(...range(B.Ac, 1, 8, 11));           // Power when the Holy Spirit comes
    refs.push(v(B.Ac, 2, 1), v(B.Ac, 2, 2), v(B.Ac, 2, 3), v(B.Ac, 2, 4)); // Pentecost
    refs.push(v(B.Ac, 2, 17), v(B.Ac, 2, 21));
    refs.push(v(B.Ac, 2, 38), v(B.Ac, 2, 39));
    refs.push(v(B.Ac, 2, 42), v(B.Ac, 2, 44), v(B.Ac, 2, 46), v(B.Ac, 2, 47));
    refs.push(v(B.Ac, 4, 12));                     // No other name
    refs.push(v(B.Ac, 16, 31));                    // Believe on the Lord Jesus
    refs.push(v(B.Ac, 17, 28));
    refs.push(v(B.Ac, 20, 35));                    // More blessed to give

    // ═══════════════════════════════════════════════════════
    // ROMANS — Doctrine, salvation, sanctification
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Rm, 1, 16), v(B.Rm, 1, 17));    // Not ashamed of the Gospel
    refs.push(v(B.Rm, 3, 23), v(B.Rm, 3, 24));    // All have sinned
    refs.push(v(B.Rm, 4, 17));
    refs.push(v(B.Rm, 5, 1), v(B.Rm, 5, 2), v(B.Rm, 5, 3), v(B.Rm, 5, 4), v(B.Rm, 5, 5));
    refs.push(v(B.Rm, 5, 8));                      // While we were sinners
    refs.push(v(B.Rm, 6, 6), v(B.Rm, 6, 23));     // Wages of sin
    refs.push(...range(B.Rm, 8, 1, 2));
    refs.push(v(B.Rm, 8, 5), v(B.Rm, 8, 6));
    refs.push(v(B.Rm, 8, 11));
    refs.push(v(B.Rm, 8, 14), v(B.Rm, 8, 15), v(B.Rm, 8, 16), v(B.Rm, 8, 17), v(B.Rm, 8, 18));
    refs.push(v(B.Rm, 8, 26), v(B.Rm, 8, 28));    // All things work together
    refs.push(v(B.Rm, 8, 31), v(B.Rm, 8, 32));
    refs.push(v(B.Rm, 8, 35), v(B.Rm, 8, 37), v(B.Rm, 8, 38), v(B.Rm, 8, 39));  // Nothing shall separate us
    refs.push(v(B.Rm, 10, 9), v(B.Rm, 10, 10), v(B.Rm, 10, 13), v(B.Rm, 10, 17)); // Confess with your mouth
    refs.push(...range(B.Rm, 12, 1, 2));           // Living sacrifice
    refs.push(v(B.Rm, 12, 9), v(B.Rm, 12, 10), v(B.Rm, 12, 12), v(B.Rm, 12, 21));
    refs.push(v(B.Rm, 13, 11), v(B.Rm, 13, 14));
    refs.push(v(B.Rm, 14, 8), v(B.Rm, 14, 17));
    refs.push(v(B.Rm, 15, 4), v(B.Rm, 15, 13));

    // ═══════════════════════════════════════════════════════
    // 1 CORINTHIANS — Church life, love chapter
    // ═══════════════════════════════════════════════════════
    refs.push(v(B['1Co'], 1, 18), v(B['1Co'], 1, 27));
    refs.push(v(B['1Co'], 2, 9));                   // Eye has not seen
    refs.push(v(B['1Co'], 3, 16));
    refs.push(v(B['1Co'], 6, 19), v(B['1Co'], 6, 20));  // Body is a temple
    refs.push(v(B['1Co'], 9, 24), v(B['1Co'], 9, 25));
    refs.push(v(B['1Co'], 10, 13));                  // No temptation
    refs.push(v(B['1Co'], 10, 31));
    refs.push(v(B['1Co'], 12, 12), v(B['1Co'], 12, 13), v(B['1Co'], 12, 27));
    refs.push(...range(B['1Co'], 13, 1, 13));        // Love chapter
    refs.push(v(B['1Co'], 15, 3), v(B['1Co'], 15, 4), v(B['1Co'], 15, 10));
    refs.push(v(B['1Co'], 15, 33));
    refs.push(v(B['1Co'], 15, 55), v(B['1Co'], 15, 57), v(B['1Co'], 15, 58)); // Death where is thy sting
    refs.push(v(B['1Co'], 16, 13), v(B['1Co'], 16, 14));

    // ═══════════════════════════════════════════════════════
    // 2 CORINTHIANS
    // ═══════════════════════════════════════════════════════
    refs.push(v(B['2Co'], 1, 3), v(B['2Co'], 1, 4));
    refs.push(v(B['2Co'], 3, 17), v(B['2Co'], 3, 18));
    refs.push(v(B['2Co'], 4, 7), v(B['2Co'], 4, 8), v(B['2Co'], 4, 9));
    refs.push(v(B['2Co'], 4, 16), v(B['2Co'], 4, 17), v(B['2Co'], 4, 18));
    refs.push(v(B['2Co'], 5, 7));                    // Walk by faith
    refs.push(v(B['2Co'], 5, 17), v(B['2Co'], 5, 21)); // New creation
    refs.push(v(B['2Co'], 6, 2));
    refs.push(v(B['2Co'], 9, 6), v(B['2Co'], 9, 7), v(B['2Co'], 9, 8)); // Cheerful giver
    refs.push(v(B['2Co'], 10, 4), v(B['2Co'], 10, 5));
    refs.push(v(B['2Co'], 12, 9), v(B['2Co'], 12, 10));  // My grace is sufficient

    // ═══════════════════════════════════════════════════════
    // GALATIANS
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Gl, 2, 20));                       // Crucified with Christ
    refs.push(v(B.Gl, 3, 28));
    refs.push(v(B.Gl, 5, 1));                        // Stand fast in liberty
    refs.push(v(B.Gl, 5, 13));
    refs.push(...range(B.Gl, 5, 22, 26));             // Fruit of the Spirit
    refs.push(v(B.Gl, 6, 2), v(B.Gl, 6, 7), v(B.Gl, 6, 9)); // Reap what you sow

    // ═══════════════════════════════════════════════════════
    // EPHESIANS — Identity in Christ
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Ep, 1, 3), v(B.Ep, 1, 4), v(B.Ep, 1, 7), v(B.Ep, 1, 11));
    refs.push(v(B.Ep, 1, 17), v(B.Ep, 1, 18));
    refs.push(v(B.Ep, 2, 4), v(B.Ep, 2, 5));
    refs.push(v(B.Ep, 2, 8), v(B.Ep, 2, 9), v(B.Ep, 2, 10));  // By grace through faith
    refs.push(v(B.Ep, 3, 16), v(B.Ep, 3, 17), v(B.Ep, 3, 20), v(B.Ep, 3, 21)); // Exceeding abundantly
    refs.push(v(B.Ep, 4, 2), v(B.Ep, 4, 3), v(B.Ep, 4, 4), v(B.Ep, 4, 5), v(B.Ep, 4, 6));
    refs.push(v(B.Ep, 4, 11), v(B.Ep, 4, 12), v(B.Ep, 4, 13));
    refs.push(v(B.Ep, 4, 26), v(B.Ep, 4, 29), v(B.Ep, 4, 32));
    refs.push(v(B.Ep, 5, 1), v(B.Ep, 5, 2));
    refs.push(v(B.Ep, 5, 18), v(B.Ep, 5, 19), v(B.Ep, 5, 20));
    refs.push(v(B.Ep, 5, 25), v(B.Ep, 5, 28), v(B.Ep, 5, 33));
    refs.push(...range(B.Ep, 6, 10, 18));             // Armor of God

    // ═══════════════════════════════════════════════════════
    // PHILIPPIANS — Joy
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Ph, 1, 6), v(B.Ph, 1, 21));        // To live is Christ
    refs.push(v(B.Ph, 2, 3), v(B.Ph, 2, 4), v(B.Ph, 2, 5));
    refs.push(v(B.Ph, 2, 9), v(B.Ph, 2, 10), v(B.Ph, 2, 11));
    refs.push(v(B.Ph, 2, 13), v(B.Ph, 2, 14), v(B.Ph, 2, 15));
    refs.push(v(B.Ph, 3, 8), v(B.Ph, 3, 10), v(B.Ph, 3, 13), v(B.Ph, 3, 14)); // Press toward the mark
    refs.push(v(B.Ph, 4, 4), v(B.Ph, 4, 5));
    refs.push(v(B.Ph, 4, 6), v(B.Ph, 4, 7));         // Be anxious for nothing
    refs.push(v(B.Ph, 4, 8));                          // Think on these things
    refs.push(v(B.Ph, 4, 11), v(B.Ph, 4, 12), v(B.Ph, 4, 13));  // I can do all things
    refs.push(v(B.Ph, 4, 19));                         // Supply all your needs

    // ═══════════════════════════════════════════════════════
    // COLOSSIANS
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Cl, 1, 15), v(B.Cl, 1, 16), v(B.Cl, 1, 17));
    refs.push(v(B.Cl, 2, 6), v(B.Cl, 2, 7));
    refs.push(...range(B.Cl, 3, 1, 4));
    refs.push(v(B.Cl, 3, 12), v(B.Cl, 3, 13), v(B.Cl, 3, 14));
    refs.push(v(B.Cl, 3, 16), v(B.Cl, 3, 17), v(B.Cl, 3, 23));

    // ═══════════════════════════════════════════════════════
    // 1 & 2 THESSALONIANS
    // ═══════════════════════════════════════════════════════
    refs.push(v(B['1Th'], 4, 13), v(B['1Th'], 4, 14), v(B['1Th'], 4, 16), v(B['1Th'], 4, 17)); // Caught up
    refs.push(v(B['1Th'], 5, 11), v(B['1Th'], 5, 16), v(B['1Th'], 5, 17), v(B['1Th'], 5, 18)); // Pray without ceasing
    refs.push(v(B['2Th'], 3, 3));

    // ═══════════════════════════════════════════════════════
    // 1 & 2 TIMOTHY
    // ═══════════════════════════════════════════════════════
    refs.push(v(B['1Tm'], 2, 5));
    refs.push(v(B['1Tm'], 4, 12));                    // Let no man despise thy youth
    refs.push(v(B['1Tm'], 6, 6), v(B['1Tm'], 6, 10), v(B['1Tm'], 6, 12));
    refs.push(v(B['2Tm'], 1, 7));                     // Spirit of power, love, sound mind
    refs.push(v(B['2Tm'], 2, 15));                    // Study to show thyself approved
    refs.push(v(B['2Tm'], 3, 16), v(B['2Tm'], 3, 17)); // All scripture God-breathed
    refs.push(v(B['2Tm'], 4, 7), v(B['2Tm'], 4, 8));

    // ═══════════════════════════════════════════════════════
    // TITUS
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Tt, 2, 11), v(B.Tt, 2, 12), v(B.Tt, 2, 13), v(B.Tt, 2, 14));
    refs.push(v(B.Tt, 3, 5));

    // ═══════════════════════════════════════════════════════
    // HEBREWS — Faith chapter
    // ═══════════════════════════════════════════════════════
    // Note: Heb abbreviation same as Habakkuk 'hb' — using Heb key
    const Heb = B.Heb; // 'hb'
    refs.push(v(Heb, 4, 12));                         // Word of God is living and active
    refs.push(v(Heb, 4, 15), v(Heb, 4, 16));
    refs.push(v(Heb, 10, 23), v(Heb, 10, 24), v(Heb, 10, 25));  // Do not forsake assembling
    refs.push(v(Heb, 11, 1), v(Heb, 11, 3), v(Heb, 11, 6));    // Faith is the substance
    refs.push(v(Heb, 11, 8));
    refs.push(v(Heb, 12, 1), v(Heb, 12, 2));         // Cloud of witnesses
    refs.push(v(Heb, 12, 6), v(Heb, 12, 11));
    refs.push(v(Heb, 13, 5), v(Heb, 13, 6), v(Heb, 13, 8)); // Jesus Christ same yesterday

    // ═══════════════════════════════════════════════════════
    // JAMES — Practical faith
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Jm, 1, 2), v(B.Jm, 1, 3), v(B.Jm, 1, 4), v(B.Jm, 1, 5));  // Count it all joy
    refs.push(v(B.Jm, 1, 12), v(B.Jm, 1, 17), v(B.Jm, 1, 19), v(B.Jm, 1, 22));
    refs.push(v(B.Jm, 2, 17), v(B.Jm, 2, 26));       // Faith without works
    refs.push(v(B.Jm, 3, 5), v(B.Jm, 3, 6));
    refs.push(v(B.Jm, 4, 6), v(B.Jm, 4, 7), v(B.Jm, 4, 8), v(B.Jm, 4, 10)); // Submit to God, resist the devil
    refs.push(v(B.Jm, 4, 14));
    refs.push(v(B.Jm, 5, 13), v(B.Jm, 5, 14), v(B.Jm, 5, 15), v(B.Jm, 5, 16)); // Pray for one another

    // ═══════════════════════════════════════════════════════
    // 1 & 2 PETER
    // ═══════════════════════════════════════════════════════
    refs.push(v(B['1Pe'], 1, 3), v(B['1Pe'], 1, 6), v(B['1Pe'], 1, 7));
    refs.push(v(B['1Pe'], 2, 2), v(B['1Pe'], 2, 9), v(B['1Pe'], 2, 24));  // Royal priesthood
    refs.push(v(B['1Pe'], 3, 15));
    refs.push(v(B['1Pe'], 4, 8));
    refs.push(v(B['1Pe'], 5, 6), v(B['1Pe'], 5, 7), v(B['1Pe'], 5, 8), v(B['1Pe'], 5, 10)); // Cast your cares
    refs.push(v(B['2Pe'], 1, 3), v(B['2Pe'], 1, 4));
    refs.push(v(B['2Pe'], 3, 8), v(B['2Pe'], 3, 9));

    // ═══════════════════════════════════════════════════════
    // 1, 2, 3 JOHN
    // ═══════════════════════════════════════════════════════
    refs.push(v(B['1Jo'], 1, 5), v(B['1Jo'], 1, 7), v(B['1Jo'], 1, 9));  // If we confess
    refs.push(v(B['1Jo'], 2, 1), v(B['1Jo'], 2, 2), v(B['1Jo'], 2, 15), v(B['1Jo'], 2, 17));
    refs.push(v(B['1Jo'], 3, 1), v(B['1Jo'], 3, 2), v(B['1Jo'], 3, 16), v(B['1Jo'], 3, 18));
    refs.push(v(B['1Jo'], 4, 4));                     // Greater is He that is in you
    refs.push(v(B['1Jo'], 4, 7), v(B['1Jo'], 4, 8));  // God is love
    refs.push(v(B['1Jo'], 4, 10), v(B['1Jo'], 4, 11), v(B['1Jo'], 4, 18), v(B['1Jo'], 4, 19));
    refs.push(v(B['1Jo'], 5, 3), v(B['1Jo'], 5, 4), v(B['1Jo'], 5, 11), v(B['1Jo'], 5, 13), v(B['1Jo'], 5, 14));
    refs.push(v(B['3Jo'], 1, 2));                     // Prosper and be in health

    // ═══════════════════════════════════════════════════════
    // JUDE
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Jd, 1, 24), v(B.Jd, 1, 25));       // Able to keep you from falling

    // ═══════════════════════════════════════════════════════
    // REVELATION — End times favorites
    // ═══════════════════════════════════════════════════════
    refs.push(v(B.Re, 1, 8));                          // Alpha and Omega
    refs.push(v(B.Re, 3, 8), v(B.Re, 3, 20));         // I stand at the door
    refs.push(v(B.Re, 4, 8), v(B.Re, 4, 11));
    refs.push(v(B.Re, 5, 5));
    refs.push(v(B.Re, 7, 17));
    refs.push(v(B.Re, 12, 11));                        // Overcame by the blood
    refs.push(v(B.Re, 19, 11), v(B.Re, 19, 16));
    refs.push(v(B.Re, 21, 1), v(B.Re, 21, 3), v(B.Re, 21, 4), v(B.Re, 21, 5)); // New heaven new earth
    refs.push(v(B.Re, 22, 12), v(B.Re, 22, 13), v(B.Re, 22, 17));
    refs.push(v(B.Re, 22, 20), v(B.Re, 22, 21));      // Come Lord Jesus

    // De-duplicate
    const seen = new Set<string>();
    const unique: VerseRef[] = [];
    for (const ref of refs) {
        const key = `${ref.book}:${ref.chapter}:${ref.verse}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(ref);
        }
    }

    return unique;
}
