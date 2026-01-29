/**
 * CREENLY License Key Generator
 * 
 * Pricing:
 *   - Monthly: $20/month
 *   - Yearly: $200/year
 * 
 * Usage:
 *   node scripts/generate-keys.js monthly <email>    # 1 month access
 *   node scripts/generate-keys.js yearly <email>     # 12 months access
 *   node scripts/generate-keys.js extend <email> monthly|yearly
 *   node scripts/generate-keys.js list
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ejqzexdkoqbvgmjtbbwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXpleGRrb3FidmdtanRiYndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2ODQ2ODgsImV4cCI6MjA4NTI2MDY4OH0.4YXGoTou1abHjT06zS4a338linJmO7an1X2MKX_bV_Y';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Plan configuration
const PLANS = {
    monthly: { months: 1, label: 'Monthly ($20)' },
    yearly: { months: 12, label: 'Yearly ($200)' }
};

// Generate a random key code
function generateKeyCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let key = 'CRN-';
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (i < 3) key += '-';
    }
    return key;
}

async function generateLicense(planType, email) {
    const plan = PLANS[planType];
    if (!plan) {
        console.error(`❌ Invalid plan. Use 'monthly' or 'yearly'`);
        return null;
    }

    console.log(`\n🔑 Generating ${plan.label} license for: ${email}\n`);

    const keyCode = generateKeyCode();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + plan.months);

    const { data, error } = await supabase
        .from('licenses')
        .insert({
            license_key: keyCode,
            email: email,
            status: 'active',
            plan: planType,
            current_period_end: currentPeriodEnd.toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error(`❌ Error: ${error.message}`);
        return null;
    }

    console.log('━'.repeat(55));
    console.log(`✅ License Key:  ${keyCode}`);
    console.log(`   Email:        ${email}`);
    console.log(`   Plan:         ${plan.label}`);
    console.log(`   Expires:      ${currentPeriodEnd.toLocaleDateString()}`);
    console.log('━'.repeat(55));
    console.log(`\n📧 Send this key to the customer.\n`);

    return keyCode;
}

async function extendLicense(email, planType) {
    const plan = PLANS[planType];
    if (!plan) {
        console.error(`❌ Invalid plan. Use 'monthly' or 'yearly'`);
        return null;
    }

    console.log(`\n🔄 Extending license for: ${email} (+${plan.label})\n`);

    // Find existing license
    const { data: license, error: fetchError } = await supabase
        .from('licenses')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (fetchError || !license) {
        console.error(`❌ No license found for: ${email}`);
        console.log(`   Tip: Generate a new one with: node scripts/generate-keys.js ${planType} "${email}"`);
        return null;
    }

    // Calculate new expiry (extend from current end, or from now if expired)
    const currentEnd = new Date(license.current_period_end);
    const now = new Date();
    const startDate = currentEnd > now ? currentEnd : now;
    const newEnd = new Date(startDate);
    newEnd.setMonth(newEnd.getMonth() + plan.months);

    const { error: updateError } = await supabase
        .from('licenses')
        .update({
            status: 'active',
            plan: planType,
            current_period_end: newEnd.toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', license.id);

    if (updateError) {
        console.error(`❌ Error: ${updateError.message}`);
        return null;
    }

    console.log('━'.repeat(55));
    console.log(`✅ License Extended!`);
    console.log(`   Key:          ${license.license_key}`);
    console.log(`   Plan:         ${plan.label}`);
    console.log(`   New Expiry:   ${newEnd.toLocaleDateString()}`);
    console.log('━'.repeat(55));
    console.log(`\n💡 Customer's existing key continues to work.\n`);

    return license.license_key;
}

async function listLicenses() {
    const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error(`❌ Error: ${error.message}`);
        return;
    }

    if (data.length === 0) {
        console.log('\n📋 No licenses found.\n');
        return;
    }

    console.log('\n📋 Recent Licenses:\n');
    console.log('━'.repeat(95));
    console.log('KEY                      STATUS      PLAN      EMAIL                           EXPIRES');
    console.log('━'.repeat(95));

    data.forEach(lic => {
        const expiry = new Date(lic.current_period_end);
        const isExpired = expiry < new Date();
        const status = isExpired ? 'EXPIRED' : lic.status.toUpperCase();
        const plan = (lic.plan || 'monthly').padEnd(8);
        const emailShort = lic.email.length > 30 ? lic.email.slice(0, 27) + '...' : lic.email.padEnd(30);

        console.log(`${lic.license_key}  ${status.padEnd(10)}  ${plan}  ${emailShort}  ${expiry.toLocaleDateString()}`);
    });

    console.log('━'.repeat(95));
    console.log(`\nTotal: ${data.length} license(s)\n`);
}

// Help text
function showHelp() {
    console.log(`
📖 CREENLY License Manager

GENERATE NEW LICENSE:
  node scripts/generate-keys.js monthly <email>     Create 1-month license ($20)
  node scripts/generate-keys.js yearly <email>      Create 12-month license ($200)

EXTEND EXISTING LICENSE:
  node scripts/generate-keys.js extend <email> monthly   Add 1 month
  node scripts/generate-keys.js extend <email> yearly    Add 12 months

LIST LICENSES:
  node scripts/generate-keys.js list

EXAMPLES:
  node scripts/generate-keys.js monthly "pastor@church.org"
  node scripts/generate-keys.js yearly "admin@megachurch.org"
  node scripts/generate-keys.js extend "pastor@church.org" monthly
`);
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
    showHelp();
    process.exit(0);
}

const command = args[0].toLowerCase();

switch (command) {
    case 'list':
        listLicenses().then(() => process.exit(0));
        break;

    case 'extend':
        const extendEmail = args[1];
        const extendPlan = args[2]?.toLowerCase() || 'monthly';
        if (!extendEmail) {
            console.log('❌ Please provide an email: node scripts/generate-keys.js extend <email> monthly|yearly');
            process.exit(1);
        }
        extendLicense(extendEmail, extendPlan).then(() => process.exit(0));
        break;

    case 'monthly':
    case 'yearly':
        const email = args[1];
        if (!email) {
            console.log(`❌ Please provide an email: node scripts/generate-keys.js ${command} <email>`);
            process.exit(1);
        }
        generateLicense(command, email).then(() => process.exit(0));
        break;

    case 'help':
    case '--help':
    case '-h':
        showHelp();
        break;

    default:
        console.log(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
}
