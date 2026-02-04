/**
 * CREENLY License Webhook Handler
 * 
 * This endpoint receives webhooks from LemonSqueezy when:
 * - New subscription created
 * - Subscription renewed
 * - Subscription cancelled/expired
 * 
 * Deploy this to Vercel, Netlify, or any serverless platform.
 * 
 * Environment Variables needed:
 * - LEMON_SQUEEZY_WEBHOOK_SECRET: Your webhook signing secret
 * - SUPABASE_URL: Your Supabase URL
 * - SUPABASE_SERVICE_KEY: Supabase service role key (not anon)
 * - RESEND_API_KEY: For sending license emails
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration (set these as environment variables in production)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ejqzexdkoqbvgmjtbbwd.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const WEBHOOK_SECRET = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || '';

// Initialize Supabase with service key for full access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Generate license key
function generateLicenseKey() {
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

// Send license email via Resend
// Plan configuration with hours
const PLANS = {
    monthly: { months: 1, hours: 40, label: 'Monthly ($15)', hoursLabel: '40 hours' },
    sixmonth: { months: 6, hours: 240, label: '6-Month ($90)', hoursLabel: '240 hours' },
    yearly: { months: 12, hours: 480, label: 'Annual ($180)', hoursLabel: '480 hours' }
};

async function sendLicenseEmail(email, licenseKey, plan, expiresAt, hoursLimit) {
    if (!RESEND_API_KEY) {
        console.log('RESEND_API_KEY not set, skipping email');
        return;
    }

    const planConfig = PLANS[plan] || PLANS.monthly;
    const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: 'CREENLY <license@creenly.com>',
            to: email,
            subject: '🔑 Your CREENLY License Key',
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                    <div style="text-align: center; margin-bottom: 40px;">
                        <div style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 16px 24px; border-radius: 12px;">
                            <span style="color: white; font-size: 24px; font-weight: bold;">CREENLY</span>
                        </div>
                    </div>
                    
                    <h1 style="color: #1a1a1a; font-size: 28px; margin-bottom: 16px;">Thank you for subscribing!</h1>
                    
                    <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                        Your CREENLY Pro license is ready. Enter this key in the app to activate:
                    </p>
                    
                    <div style="background: #1a1a1a; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
                        <code style="color: #22c55e; font-size: 24px; font-weight: bold; letter-spacing: 2px;">
                            ${licenseKey}
                        </code>
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 24px 0;">
                        <p style="margin: 0; color: #6b7280; font-size: 14px;">
                            <strong>Plan:</strong> ${planConfig.label}<br>
                            <strong>Hours Included:</strong> ${planConfig.hoursLabel}<br>
                            <strong>Valid until:</strong> ${expiryDate}
                        </p>
                    </div>
                    
                    <h3 style="color: #1a1a1a; margin-top: 32px;">How to activate:</h3>
                    <ol style="color: #4a4a4a; font-size: 14px; line-height: 1.8;">
                        <li>Open CREENLY on your computer</li>
                        <li>Click the <strong>"License"</strong> button in the top bar</li>
                        <li>Enter your license key</li>
                        <li>Click <strong>Activate</strong></li>
                    </ol>
                    
                    <p style="color: #9ca3af; font-size: 12px; margin-top: 40px; text-align: center;">
                        This key is for one device only. Keep it safe!<br>
                        Questions? Reply to this email.
                    </p>
                </div>
            `
        })
    });

    if (!response.ok) {
        console.error('Failed to send email:', await response.text());
    } else {
        console.log('License email sent to:', email);
    }
}

// Main webhook handler
async function handleWebhook(event, data) {
    const email = data.attributes?.user_email || data.attributes?.customer_email;
    const customerId = data.attributes?.customer_id?.toString();
    const subscriptionId = data.id?.toString();

    // Determine plan from variant/product name
    const variantName = data.attributes?.variant_name?.toLowerCase() || '';
    const productName = data.attributes?.product_name?.toLowerCase() || '';

    let plan = 'monthly';
    if (variantName.includes('year') || productName.includes('year') || productName.includes('annual')) {
        plan = 'yearly';
    } else if (variantName.includes('6') || productName.includes('6') || variantName.includes('six') || productName.includes('six')) {
        plan = 'sixmonth';
    }

    const planConfig = PLANS[plan];
    const months = planConfig.months;
    const hoursLimit = planConfig.hours;

    console.log(`[Webhook] Event: ${event}, Email: ${email}, Plan: ${plan}, Hours: ${hoursLimit}`);

    switch (event) {
        case 'subscription_created':
        case 'order_created': {
            // Check if license already exists for this email
            const { data: existingLicense } = await supabase
                .from('licenses')
                .select('*')
                .eq('email', email)
                .single();

            if (existingLicense) {
                // Extend existing license
                const currentEnd = new Date(existingLicense.current_period_end);
                const now = new Date();
                const startDate = currentEnd > now ? currentEnd : now;
                const newEnd = new Date(startDate);
                newEnd.setMonth(newEnd.getMonth() + months);

                await supabase
                    .from('licenses')
                    .update({
                        status: 'active',
                        plan: plan,
                        customer_id: customerId,
                        subscription_id: subscriptionId,
                        current_period_end: newEnd.toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('email', email);

                console.log(`Extended license for ${email}, new expiry: ${newEnd.toISOString()}`);

                // Send confirmation email with existing key
                await sendLicenseEmail(email, existingLicense.license_key, plan, newEnd.toISOString(), hoursLimit);
            } else {
                // Create new license
                const licenseKey = generateLicenseKey();
                const expiresAt = new Date();
                expiresAt.setMonth(expiresAt.getMonth() + months);

                await supabase.from('licenses').insert({
                    license_key: licenseKey,
                    email: email,
                    customer_id: customerId,
                    subscription_id: subscriptionId,
                    status: 'active',
                    plan: plan,
                    current_period_end: expiresAt.toISOString(),
                    usage_hours_limit: hoursLimit,
                    usage_hours_used: 0
                });

                console.log(`Created license ${licenseKey} for ${email}`);

                // Send license email
                await sendLicenseEmail(email, licenseKey, plan, expiresAt.toISOString(), hoursLimit);
            }
            break;
        }

        case 'subscription_updated':
        case 'subscription_payment_success': {
            // Extend the subscription
            const { data: license } = await supabase
                .from('licenses')
                .select('*')
                .eq('email', email)
                .single();

            if (license) {
                const currentEnd = new Date(license.current_period_end);
                const now = new Date();
                const startDate = currentEnd > now ? currentEnd : now;
                const newEnd = new Date(startDate);
                newEnd.setMonth(newEnd.getMonth() + months);

                await supabase
                    .from('licenses')
                    .update({
                        status: 'active',
                        current_period_end: newEnd.toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('email', email);

                console.log(`Renewed license for ${email}, new expiry: ${newEnd.toISOString()}`);
            }
            break;
        }

        case 'subscription_cancelled':
        case 'subscription_expired': {
            await supabase
                .from('licenses')
                .update({
                    status: event === 'subscription_cancelled' ? 'cancelled' : 'expired',
                    updated_at: new Date().toISOString()
                })
                .eq('email', email);

            console.log(`License ${event} for ${email}`);
            break;
        }
    }

    return { success: true };
}

// Express/Vercel handler
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const event = req.body?.meta?.event_name;
        const data = req.body?.data;

        if (!event || !data) {
            return res.status(400).json({ error: 'Invalid webhook payload' });
        }

        await handleWebhook(event, data);
        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// For local testing
if (require.main === module) {
    console.log('Webhook handler ready. Deploy to Vercel/Netlify for production.');
}
